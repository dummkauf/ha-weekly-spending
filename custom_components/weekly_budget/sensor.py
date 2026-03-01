"""Sensor platform for the Weekly Budget integration."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    ATTR_EXPENSES,
    ATTR_ROLLOVER,
    ATTR_WEEKLY_LIMIT,
    ATTR_SPENT,
    ATTR_REMAINING,
    ATTR_CURRENCY,
    SENSOR_REMAINING,
    SENSOR_SPENT,
    SENSOR_LIMIT,
    SENSOR_ROLLOVER,
)
from . import SIGNAL_BUDGET_UPDATED, BudgetData

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Weekly Budget sensors from a config entry."""
    budget_data: BudgetData = hass.data[DOMAIN][entry.entry_id]

    entities = [
        BudgetRemainingensor(budget_data, entry),
        BudgetSpentSensor(budget_data, entry),
        BudgetLimitSensor(budget_data, entry),
        BudgetRolloverSensor(budget_data, entry),
    ]

    async_add_entities(entities, True)


class BudgetSensorBase(SensorEntity):
    """Base class for weekly budget sensors."""

    _attr_has_entity_name = True
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, budget_data: BudgetData, entry: ConfigEntry, sensor_type: str) -> None:
        """Initialize the sensor."""
        self._budget = budget_data
        self._entry = entry
        self._sensor_type = sensor_type
        self._attr_unique_id = f"{entry.entry_id}_{sensor_type}"

    async def async_added_to_hass(self) -> None:
        """Register update dispatcher."""
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_BUDGET_UPDATED, self._handle_update
            )
        )

    @callback
    def _handle_update(self) -> None:
        """Handle data update."""
        self.async_write_ha_state()

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device info to group sensors together."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": "Weekly Budget",
            "manufacturer": "Weekly Budget Tracker",
            "model": "Budget Tracker",
            "sw_version": "1.0.0",
        }


class BudgetRemainingensor(BudgetSensorBase):
    """Sensor showing the remaining budget for the week."""

    def __init__(self, budget_data: BudgetData, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(budget_data, entry, SENSOR_REMAINING)
        self._attr_name = "Budget Remaining"
        self._attr_icon = "mdi:cash"

    @property
    def native_value(self) -> float:
        """Return the remaining budget."""
        return self._budget.remaining

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the currency."""
        return self._budget.currency

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional attributes."""
        return {
            ATTR_WEEKLY_LIMIT: self._budget.weekly_limit,
            ATTR_ROLLOVER: self._budget.rollover,
            "effective_budget": self._budget.effective_budget,
            ATTR_SPENT: self._budget.total_spent,
            ATTR_CURRENCY: self._budget.currency,
            ATTR_EXPENSES: self._budget.expenses,
            "week_start": self._budget.week_start,
            "expense_count": len(self._budget.expenses),
        }


class BudgetSpentSensor(BudgetSensorBase):
    """Sensor showing total spending for the week."""

    def __init__(self, budget_data: BudgetData, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(budget_data, entry, SENSOR_SPENT)
        self._attr_name = "Budget Spent"
        self._attr_icon = "mdi:cart"

    @property
    def native_value(self) -> float:
        """Return total spent."""
        return self._budget.total_spent

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the currency."""
        return self._budget.currency

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional attributes."""
        return {
            "expense_count": len(self._budget.expenses),
            ATTR_EXPENSES: self._budget.expenses,
        }


class BudgetLimitSensor(BudgetSensorBase):
    """Sensor showing the configured weekly limit."""

    def __init__(self, budget_data: BudgetData, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(budget_data, entry, SENSOR_LIMIT)
        self._attr_name = "Weekly Limit"
        self._attr_icon = "mdi:target"

    @property
    def native_value(self) -> float:
        """Return the weekly limit."""
        return self._budget.weekly_limit

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the currency."""
        return self._budget.currency


class BudgetRolloverSensor(BudgetSensorBase):
    """Sensor showing the rollover amount from last week."""

    def __init__(self, budget_data: BudgetData, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(budget_data, entry, SENSOR_ROLLOVER)
        self._attr_name = "Budget Rollover"
        self._attr_icon = "mdi:transfer"

    @property
    def native_value(self) -> float:
        """Return the rollover amount."""
        return self._budget.rollover

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the currency."""
        return self._budget.currency

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional attributes."""
        return {
            "effective_budget": self._budget.effective_budget,
            "description": (
                "Positive = savings carried over. "
                "Negative = overspend deducted from this week."
            ),
        }
