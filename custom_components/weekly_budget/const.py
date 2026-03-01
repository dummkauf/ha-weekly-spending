"""Constants for the Weekly Budget integration."""

DOMAIN = "weekly_budget"
STORAGE_KEY = "weekly_budget_data"
STORAGE_VERSION = 1

CONF_WEEKLY_LIMIT = "weekly_limit"
CONF_CURRENCY = "currency"

DEFAULT_WEEKLY_LIMIT = 200.00
DEFAULT_CURRENCY = "$"

ATTR_AMOUNT = "amount"
ATTR_DESCRIPTION = "description"
ATTR_USER = "user"
ATTR_TIMESTAMP = "timestamp"
ATTR_EXPENSES = "expenses"
ATTR_WEEK_START = "week_start"
ATTR_ROLLOVER = "rollover"
ATTR_WEEKLY_LIMIT = "weekly_limit"
ATTR_SPENT = "spent"
ATTR_REMAINING = "remaining"
ATTR_CURRENCY = "currency"

SERVICE_ADD_EXPENSE = "add_expense"
SERVICE_RESET_BUDGET = "reset_budget"
SERVICE_SET_WEEKLY_LIMIT = "set_weekly_limit"

SENSOR_REMAINING = "remaining"
SENSOR_SPENT = "spent"
SENSOR_LIMIT = "limit"
SENSOR_ROLLOVER = "rollover"
