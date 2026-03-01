# Weekly Budget Tracker for Home Assistant

A HACS-installable Home Assistant integration that lets household members track weekly spending with automatic budget rollover.

## Features

- **Weekly spending limit** - Set a weekly budget that all household members share.
- **Expense tracking** - Users log expenses with an amount, description, and their name.
- **Automatic rollover** - Unspent money carries over to the next week. Overspending is automatically deducted.
- **Reset button** - Instantly reset the budget back to your configured weekly limit.
- **Lovelace cards** - Two custom cards: a budget overview with progress ring and an expense list.
- **Persistent storage** - All data survives Home Assistant restarts.
- **Multi-user** - Any HA user or household member can add expenses.

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Add this repository URL and select **Integration** as the category.
4. Click **Install**.
5. Restart Home Assistant.

### Manual Installation

1. Copy the `custom_components/weekly_budget/` folder (including its `www/` subfolder) into your Home Assistant `config/custom_components/` directory.
2. Restart Home Assistant.

## Setup

1. Go to **Settings > Devices & Services > Add Integration**.
2. Search for **Weekly Budget Tracker**.
3. Enter your weekly spending limit and preferred currency symbol.
4. Click **Submit**.

## Lovelace Cards

The Lovelace card resources are **automatically registered** when the integration loads -- no manual resource registration is needed.

### Adding Cards to Your Dashboard

1. Open any Lovelace dashboard and click the pencil icon (Edit).
2. Click **"+ Add Card"**.
3. Search for **"Weekly Budget"** -- you will see two cards:
   - **Weekly Budget Overview** -- budget progress ring, spending stats, rollover info, and an expense input form.
   - **Weekly Budget Expenses** -- scrollable list of all expenses with user names, descriptions, amounts, and timestamps.
4. Select a card, pick the entity from the dropdown, and click **Save**.

No YAML required.

### Budget Overview Card (YAML Reference)

```yaml
type: custom:weekly-budget-card
entity: sensor.weekly_budget_remaining
```

### Expenses List Card (YAML Reference)

```yaml
type: custom:weekly-budget-expenses-card
entity: sensor.weekly_budget_remaining
title: "Expenses This Week"
max_items: 30
show_total: true
```

> **YAML-mode dashboards:** If your Lovelace is in YAML mode (not storage mode), add these resources manually at the top of your `ui-lovelace.yaml`:
> ```yaml
> resources:
>   - url: /weekly_budget/weekly-budget-card.js
>     type: module
>   - url: /weekly_budget/weekly-budget-expenses-card.js
>     type: module
> ```

## Sensors Created

| Entity | Description |
|--------|-------------|
| `sensor.weekly_budget_remaining` | How much budget is left (includes rollover). Attributes include full expense list. |
| `sensor.weekly_budget_spent` | Total amount spent this week. |
| `sensor.weekly_budget_limit` | The configured weekly limit. |
| `sensor.weekly_budget_rollover` | Rollover from last week (positive = savings, negative = overspend). |

## Services

| Service | Description | Parameters |
|---------|-------------|------------|
| `weekly_budget.add_expense` | Add a new expense | `amount` (required), `description` (required), `user` (optional) |
| `weekly_budget.reset_budget` | Reset budget to configured limit, clear expenses and rollover | none |
| `weekly_budget.set_weekly_limit` | Change the weekly spending limit | `amount` (required) |

### Service Examples

**Add an expense via automation:**
```yaml
service: weekly_budget.add_expense
data:
  amount: 42.50
  description: "Grocery run"
  user: "Alice"
```

**Reset the budget:**
```yaml
service: weekly_budget.reset_budget
```

**Change the weekly limit:**
```yaml
service: weekly_budget.set_weekly_limit
data:
  amount: 300
```

## How Rollover Works

- At the start of each new week (Monday), the integration calculates: `rollover = (weekly_limit + previous_rollover) - spent`
- **Under budget:** The surplus is added to next week's effective budget.
- **Over budget:** The deficit is subtracted from next week's effective budget.
- **Reset:** Clears all expenses, sets rollover to 0, and restarts from the configured weekly limit.

## File Structure

```
custom_components/weekly_budget/
  __init__.py         # Integration setup, services, frontend registration, rollover logic
  config_flow.py      # UI configuration flow
  const.py            # Constants
  manifest.json       # Integration manifest
  sensor.py           # Sensor entities
  services.yaml       # Service definitions
  strings.json        # UI strings
  translations/
    en.json           # English translations
  www/
    weekly-budget-card.js           # Budget overview Lovelace card
    weekly-budget-expenses-card.js  # Expense list Lovelace card
hacs.json                           # HACS configuration
```

## License

MIT
