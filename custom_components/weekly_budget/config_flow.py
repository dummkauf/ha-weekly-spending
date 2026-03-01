"""Config flow for the Weekly Budget integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers import config_validation as cv

from .const import (
    DOMAIN,
    CONF_WEEKLY_LIMIT,
    CONF_CURRENCY,
    CONF_WEEK_START_DAY,
    DEFAULT_WEEKLY_LIMIT,
    DEFAULT_CURRENCY,
    DEFAULT_WEEK_START_DAY,
    DAYS_OF_WEEK,
)


class WeeklyBudgetConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Weekly Budget."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            weekly_limit = user_input.get(CONF_WEEKLY_LIMIT, DEFAULT_WEEKLY_LIMIT)
            currency = user_input.get(CONF_CURRENCY, DEFAULT_CURRENCY)
            week_start_day = user_input.get(CONF_WEEK_START_DAY, DEFAULT_WEEK_START_DAY)

            if weekly_limit <= 0:
                errors[CONF_WEEKLY_LIMIT] = "invalid_limit"
            else:
                return self.async_create_entry(
                    title=f"Weekly Budget ({currency}{weekly_limit:.2f})",
                    data={
                        CONF_WEEKLY_LIMIT: weekly_limit,
                        CONF_CURRENCY: currency,
                        CONF_WEEK_START_DAY: week_start_day,
                    },
                )

        data_schema = vol.Schema(
            {
                vol.Required(
                    CONF_WEEKLY_LIMIT, default=DEFAULT_WEEKLY_LIMIT
                ): vol.Coerce(float),
                vol.Optional(
                    CONF_CURRENCY, default=DEFAULT_CURRENCY
                ): cv.string,
                vol.Optional(
                    CONF_WEEK_START_DAY, default=DEFAULT_WEEK_START_DAY
                ): vol.In(DAYS_OF_WEEK),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )
