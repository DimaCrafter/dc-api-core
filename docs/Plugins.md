# Plugin development manual

## Requirements

1. Package should be named as `dc-api-pluginName`.
2. `index.js` or other main script file must export method.
3. It'll be great, if you write at least simple documentation.

---

## `core` object

When core loads your plugin, it's starts exported method with 1 parameter (`Object`), than described here.

| Field                 | Type       | Description |
|-----------------------|------------|-------------|
| `register(type, val)` | `Function` | WIP         |

---

## Database plugins

Coming soon, but if you want do this now, you can try to understand [dc-api-mysql] and [dc-api-mongo] plugins

[dc-api-mysql]: https://github.com/DimaCrafter/dc-api-mysql
[dc-api-mongo]: https://github.com/DimaCrafter/dc-api-mongo
