# Code styling

## Controllers naming

Main rules:

1) Use only PascalCase for naming.
2) File name = Class name plus `.js` extension

Note:
HTTP requests url part will be transformed from kebab-case to PascalCase,
but you shouldn't worry about that if you using my API class.

## Database using

Bad way:

```js
const DB = require('dc-api-core/DB');
const db = DB.mongo;
```

Yes, you can use `DB` for storing drivers wrapper, also you can use `db`
for storing driver's instance, but not both in one file!

---------------------------------------------------------------------------

Better:

```js
const { mongo: db } = require('dc-api-core/DB');
```

Yes, this better, because it declarates that in this file will be used only
`mongo` as database (`db`). And there are no case-sensitive variables.

I think this is good compromise between useability and readability.

---------------------------------------------------------------------------

Very good way:

```js
const { mongo } = require('dc-api-core/DB');
```
