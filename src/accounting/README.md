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

## Using with TLS verification

- Create `tls` folder here

- Add cert files to this folder like this:
```text
accounting/
└── tls/
    ├── ca.pem
    ├── client.pem
    └── client-key.pem
```

- Check paths to files in `.env` file and enable `TLS_VERIFY`
```dotenv
# Enable or disable tls verify
TLS_VERIFY=true

# Files with certs
TLS_CA_CERT=/usr/src/app/src/accounting/tls/ca.pem
TLS_CERT=/usr/src/app/src/accounting/tls/client.pem
TLS_KEY=/usr/src/app/src/accounting/tls/client-key.pem
```

## TODO
- [ ] Move this module to individual repository
