"""Weekly Budget Tracker integration for Home Assistant."""

from __future__ import annotations

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
from homeassistant.components.http import StaticPathConfig

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


def _monday_of_week(dt: datetime | None = None) -> str:
    """Return the Monday of the current week as an ISO date string."""
    if dt is None:
        dt = datetime.now()
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


class BudgetData:
    """Manage weekly budget data with persistence."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the budget data manager."""
        self.hass = hass
        self.entry = entry
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry.entry_id}")
        self.weekly_limit: float = entry.data.get(CONF_WEEKLY_LIMIT, DEFAULT_WEEKLY_LIMIT)
        self.currency: str = entry.data.get(CONF_CURRENCY, DEFAULT_CURRENCY)
        self.rollover: float = 0.0
        self.expenses: list[dict[str, Any]] = []
        self.week_start: str = _monday_of_week()

    async def async_load(self) -> None:
        """Load data from storage."""
        data = await self._store.async_load()
        if data:
            self.weekly_limit = data.get(ATTR_WEEKLY_LIMIT, self.weekly_limit)
            self.rollover = data.get(ATTR_ROLLOVER, 0.0)
            self.expenses = data.get(ATTR_EXPENSES, [])
            self.week_start = data.get(ATTR_WEEK_START, _monday_of_week())
            self.currency = data.get("currency", self.currency)

        # Check if we need to roll over to a new week
        self._check_week_rollover()

    def _check_week_rollover(self) -> None:
        """Check if a new week has started and handle rollover."""
        current_monday = _monday_of_week()
        if self.week_start != current_monday:
            spent = self.total_spent
            effective_budget = self.weekly_limit + self.rollover
            remaining = effective_budget - spent
            # remaining becomes next week's rollover
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
        """Calculate total amount spent this week."""
        return round(sum(e.get(ATTR_AMOUNT, 0) for e in self.expenses), 2)

    @property
    def effective_budget(self) -> float:
        """The weekly limit plus any rollover (positive or negative)."""
        return round(self.weekly_limit + self.rollover, 2)

    @property
    def remaining(self) -> float:
        """Calculate how much budget remains."""
        return round(self.effective_budget - self.total_spent, 2)

    async def async_save(self) -> None:
        """Persist data to storage."""
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
        """Add a new expense."""
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
        """Reset budget: clear expenses, zero out rollover, restart the week."""
        self.rollover = 0.0
        self.expenses = []
        self.week_start = _monday_of_week()
        await self.async_save()
        async_dispatcher_send(self.hass, SIGNAL_BUDGET_UPDATED)

    async def async_set_weekly_limit(self, amount: float) -> None:
        """Update the weekly spending limit."""
        self.weekly_limit = round(amount, 2)
        # Also update the config entry for persistence across restarts
        self.hass.config_entries.async_update_entry(
            self.entry,
            data={**self.entry.data, CONF_WEEKLY_LIMIT: self.weekly_limit},
        )
        await self.async_save()
        async_dispatcher_send(self.hass, SIGNAL_BUDGET_UPDATED)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve card JS files and inject them into the HA frontend.

    Follows the same pattern used by browser_mod and other proven HACS
    integrations:
      1. Register static paths so the HA HTTP server can serve the JS files.
      2. Call add_extra_js_url with a cache-busting query string so the
         frontend injects <script type="module"> tags on every page load.
      3. The cards' window.customCards.push() calls then register them in
         the Lovelace card picker automatically.
    """
    from homeassistant.components.frontend import add_extra_js_url

    CARD_FILES = [
        "weekly-budget-card.js",
        "weekly-budget-expenses-card.js",
        "weekly-budget-add-expense-card.js",
    ]

    # Use hass.config.path() for reliable absolute paths, just like browser_mod
    www_dir = hass.config.path(f"custom_components/{DOMAIN}/www")

    # 1. Serve the JS files at /weekly_budget/<filename>
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=f"/{DOMAIN}/{filename}",
                path=os.path.join(www_dir, filename),
                cache_headers=False,
            )
            for filename in CARD_FILES
        ]
    )

    # 2. Tell the frontend to load them as ES modules on every page.
    #    The cache-busting query param ensures browsers fetch the latest
    #    version after updates (same technique used by browser_mod).
    cache_buster = "1.1.0"
    for filename in CARD_FILES:
        add_extra_js_url(hass, f"/{DOMAIN}/{filename}?v={cache_buster}")


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Weekly Budget from a config entry."""

    # ── Register frontend card resources (once) ──────────────────────
    if f"{DOMAIN}_frontend_registered" not in hass.data:
        hass.data[f"{DOMAIN}_frontend_registered"] = True
        await _async_register_frontend(hass)

    budget_data = BudgetData(hass, entry)
    await budget_data.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = budget_data

    # Register services (only once)
    if not hass.services.has_service(DOMAIN, SERVICE_ADD_EXPENSE):
        async def handle_add_expense(call: ServiceCall) -> None:
            """Handle add_expense service call.

            Automatically resolves the HA username from the service call
            context so users never need to type their name.
            """
            amount = call.data[ATTR_AMOUNT]
            description = call.data[ATTR_DESCRIPTION]

            # Resolve the calling user's display name from HA auth
            user_name = "Unknown"
            if call.context.user_id:
                try:
                    user = await hass.auth.async_get_user(call.context.user_id)
                    if user and user.name:
                        user_name = user.name
                except Exception:  # noqa: BLE001
                    _LOGGER.debug("Could not resolve user name for %s", call.context.user_id)

            for data in hass.data[DOMAIN].values():
                await data.async_add_expense(amount, description, user_name)

        async def handle_reset_budget(call: ServiceCall) -> None:
            """Handle reset_budget service call."""
            for data in hass.data[DOMAIN].values():
                await data.async_reset_budget()

        async def handle_set_weekly_limit(call: ServiceCall) -> None:
            """Handle set_weekly_limit service call."""
            amount = call.data[ATTR_AMOUNT]
            for data in hass.data[DOMAIN].values():
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
        """Check for week rollover at midnight."""
        for data in hass.data.get(DOMAIN, {}).values():
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
        # Remove services if no entries remain
        if not hass.data[DOMAIN]:
            hass.services.async_remove(DOMAIN, SERVICE_ADD_EXPENSE)
            hass.services.async_remove(DOMAIN, SERVICE_RESET_BUDGET)
            hass.services.async_remove(DOMAIN, SERVICE_SET_WEEKLY_LIMIT)
    return unload_ok
