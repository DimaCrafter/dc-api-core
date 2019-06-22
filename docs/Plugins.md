# Plugin development manual

## Requirements

1. Package should be named as `dc-api-plugin-name`.
2. `index.js` or other main script file must export method.
3. It'll be great, if you write at least simple documentation.

---

## `core` object

When core loads your plugin, it's calls exported method with 1 parameter (`Object`), than described here.

Note: `->` means argument of function.

| Field                 | Type       | Description                                        |
|-----------------------|------------|----------------------------------------------------|
| `register(type, val)` | `Function` |                                                    |
| ->  `type`            | `String`   | Type of plugin. See [plugin types](#Plugin-types). |
| ->  `val`             | `Class`    | Class with structure that reqiured by plugin type. |

---

## Plugin types

Now available types is [db](DBPlugin.md).
