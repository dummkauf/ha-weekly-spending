"""Weekly Budget Tracker integration for Home Assistant."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    DOMAIN,
    STORAGE_KEY,
    STORAGE_VERSION,
    CONF_WEEKLY_LIMIT,
    CONF_CURRENCY,
    DEFAULT_WEEKLY_LIMIT,
    DEFAULT_CURRENCY,
    ATTR_AMOUNT,
    ATTR_DESCRIPTION,
    ATTR_USER,
    ATTR_EXPENSES,
    ATTR_WEEK_START,
    ATTR_ROLLOVER,
    ATTR_WEEKLY_LIMIT,
    ATTR_SPENT,
    SERVICE_ADD_EXPENSE,
    SERVICE_RESET_BUDGET,
    SERVICE_SET_WEEKLY_LIMIT,
)

_LOGGER = logging.getLogger(__name__)

SIGNAL_BUDGET_UPDATED = f"{DOMAIN}_budget_updated"

PLATFORMS = ["sensor"]

# Allow empty YAML config block so async_setup is called
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

ADD_EXPENSE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_AMOUNT): vol.Coerce(float),
        vol.Required(ATTR_DESCRIPTION): cv.string,
    }
)

SET_LIMIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_AMOUNT): vol.Coerce(float),
    }
)


# ── Helpers ──────────────────────────────────────────────────────────


def _monday_of_week(dt: datetime | None = None) -> str:
    """Return the Monday of the current week as an ISO date string."""
    if dt is None:
        dt = datetime.now()
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


def _read_version() -> str:
    """Read the integration version from manifest.json (sync, for executor)."""
    manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
    try:
        with open(manifest_path, "r") as fp:
            return json.load(fp).get("version", "0.0.0")
    except Exception:
        return "0.0.0"


# ── Frontend registration ────────────────────────────────────────────

CARDS_JS = "weekly-budget-cards.js"


def _copy_cards_to_www(hass_config_path: str) -> str:
    """Copy the JS file to config/www/ so HA serves it at /local/.

    Returns the destination path on disk.
    """
    import shutil

    src = os.path.join(os.path.dirname(__file__), CARDS_JS)
    www_dir = os.path.join(hass_config_path, "www")
    os.makedirs(www_dir, exist_ok=True)
    dst = os.path.join(www_dir, CARDS_JS)
    shutil.copy2(src, dst)
    _LOGGER.info("Weekly Budget: copied %s -> %s", src, dst)
    return dst


async def _register_cards(hass: HomeAssistant) -> None:
    """Register the Lovelace card JS with the HA frontend.

    Strategy: copy the JS file into config/www/ (which HA always serves
    at /local/) and then call add_extra_js_url to load it automatically.
    This bypasses async_register_static_paths entirely.
    """
    from homeassistant.components.frontend import add_extra_js_url

    version = await hass.async_add_executor_job(_read_version)

    # Copy JS to config/www/ on the executor thread
    await hass.async_add_executor_job(_copy_cards_to_www, hass.config.path())

    url = f"/local/{CARDS_JS}?v={version}"
    add_extra_js_url(hass, url)
    _LOGGER.info("Weekly Budget: add_extra_js_url(%s)", url)


# ── async_setup (runs before config entries, like browser_mod) ───────


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Weekly Budget integration (YAML phase).

    This registers the frontend card files early, before any config
    entry is loaded, ensuring the cards are always available.
    """
    hass.data.setdefault(DOMAIN, {})

    try:
        await _register_cards(hass)
        _LOGGER.info("Weekly Budget: frontend cards registered successfully")
    except Exception:
        _LOGGER.exception("Weekly Budget: failed to register frontend cards")

    return True


# ── Budget data manager ──────────────────────────────────────────────


class BudgetData:
    """Manage weekly budget data with persistence."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry.entry_id}")
        self.weekly_limit: float = entry.data.get(CONF_WEEKLY_LIMIT, DEFAULT_WEEKLY_LIMIT)
        self.currency: str = entry.data.get(CONF_CURRENCY, DEFAULT_CURRENCY)
        self.rollover: float = 0.0
        self.expenses: list[dict[str, Any]] = []
        self.week_start: str = _monday_of_week()

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data:
            self.weekly_limit = data.get(ATTR_WEEKLY_LIMIT, self.weekly_limit)
            self.rollover = data.get(ATTR_ROLLOVER, 0.0)
            self.expenses = data.get(ATTR_EXPENSES, [])
            self.week_start = data.get(ATTR_WEEK_START, _monday_of_week())
            self.currency = data.get("currency", self.currency)
        self._check_week_rollover()

    def _check_week_rollover(self) -> None:
        current_monday = _monday_of_week()
        if self.week_start != current_monday:
            spent = self.total_spent
            effective_budget = self.weekly_limit + self.rollover
            remaining = effective_budget - spent
            self.rollover = remaining
            self.expenses = []
            self.week_start = current_monday
            _LOGGER.info(
                "New week detected. Rollover: %s%.2f",
                self.currency,
                self.rollover,
            )

    @property
    def total_spent(self) -> float:
        return round(sum(e.get(ATTR_AMOUNT, 0) for e in self.expenses), 2)

    @property
    def effective_budget(self) -> float:
        return round(self.weekly_limit + self.rollover, 2)

    @property
    def remaining(self) -> float:
        return round(self.effective_budget - self.total_spent, 2)

    async def async_save(self) -> None:
        await self._store.async_save(
            {
                ATTR_WEEKLY_LIMIT: self.weekly_limit,
                ATTR_ROLLOVER: self.rollover,
                ATTR_EXPENSES: self.expenses,
                ATTR_WEEK_START: self.week_start,
                "currency": self.currency,
            }
        )

    async def async_add_expense(
        self, amount: float, description: str, user: str = "Unknown"
    ) -> None:
        self._check_week_rollover()
        expense = {
            ATTR_AMOUNT: round(amount, 2),
            ATTR_DESCRIPTION: description,
            ATTR_USER: user,
            "timestamp": datetime.now().isoformat(),
        }
        self.expenses.append(expense)
        await self.async_save()
        async_dispatcher_send(self.hass, SIGNAL_BUDGET_UPDATED)

    async def async_reset_budget(self) -> None:
        self.rollover = 0.0
        self.expenses = []
        self.week_start = _monday_of_week()
        await self.async_save()
        async_dispatcher_send(self.hass, SIGNAL_BUDGET_UPDATED)

    async def async_set_weekly_limit(self, amount: float) -> None:
        self.weekly_limit = round(amount, 2)
        self.hass.config_entries.async_update_entry(
            self.entry,
            data={**self.entry.data, CONF_WEEKLY_LIMIT: self.weekly_limit},
        )
        await self.async_save()
        async_dispatcher_send(self.hass, SIGNAL_BUDGET_UPDATED)


# ── Config entry setup ───────────────────────────────────────────────


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Weekly Budget from a config entry."""
    budget_data = BudgetData(hass, entry)
    await budget_data.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = budget_data

    # Register services (only once)
    if not hass.services.has_service(DOMAIN, SERVICE_ADD_EXPENSE):
        async def handle_add_expense(call: ServiceCall) -> None:
            amount = call.data[ATTR_AMOUNT]
            description = call.data[ATTR_DESCRIPTION]

            user_name = "Unknown"
            if call.context.user_id:
                try:
                    user = await hass.auth.async_get_user(call.context.user_id)
                    if user and user.name:
                        user_name = user.name
                except Exception:
                    _LOGGER.debug("Could not resolve user name for %s", call.context.user_id)

            for data in hass.data[DOMAIN].values():
                if isinstance(data, BudgetData):
                    await data.async_add_expense(amount, description, user_name)

        async def handle_reset_budget(call: ServiceCall) -> None:
            for data in hass.data[DOMAIN].values():
                if isinstance(data, BudgetData):
                    await data.async_reset_budget()

        async def handle_set_weekly_limit(call: ServiceCall) -> None:
            amount = call.data[ATTR_AMOUNT]
            for data in hass.data[DOMAIN].values():
                if isinstance(data, BudgetData):
                    await data.async_set_weekly_limit(amount)

        hass.services.async_register(
            DOMAIN, SERVICE_ADD_EXPENSE, handle_add_expense, schema=ADD_EXPENSE_SCHEMA
        )
        hass.services.async_register(
            DOMAIN, SERVICE_RESET_BUDGET, handle_reset_budget
        )
        hass.services.async_register(
            DOMAIN, SERVICE_SET_WEEKLY_LIMIT, handle_set_weekly_limit, schema=SET_LIMIT_SCHEMA
        )

    # Schedule a check at midnight every day for week rollover
    @callback
    def _midnight_check(_now: datetime) -> None:
        for data in hass.data.get(DOMAIN, {}).values():
            if isinstance(data, BudgetData):
                data._check_week_rollover()
                hass.async_create_task(data.async_save())
                async_dispatcher_send(hass, SIGNAL_BUDGET_UPDATED)

    entry.async_on_unload(
        async_track_time_change(hass, _midnight_check, hour=0, minute=0, second=5)
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        has_entries = any(
            isinstance(v, BudgetData) for v in hass.data.get(DOMAIN, {}).values()
        )
        if not has_entries:
            hass.services.async_remove(DOMAIN, SERVICE_ADD_EXPENSE)
            hass.services.async_remove(DOMAIN, SERVICE_RESET_BUDGET)
            hass.services.async_remove(DOMAIN, SERVICE_SET_WEEKLY_LIMIT)
    return unload_ok
