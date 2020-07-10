# CodeX Accounting SDK
This module simplifies communicating with CodeX Accounting API.

## Module initialization

- Import module to project
```ts
import Accounting from './accounting';
```

- Create accounting object with accounting URL in parameter
```ts
const accounting = new Accounting('127.0.0.1:25565');
```

- Use Accounting SDK in your project
```ts
accounting.createAccount({
  name: 'Workspace',
  type: AccountType.LIABILITY,
  currency: Currency.USD,
});
```

## TODO
- [ ] Move this module to individual repository
