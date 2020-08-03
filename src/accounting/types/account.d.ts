export interface Account {
    /*
     * Account id
     */
    id: string;

    /*
     * Account name (for example, "Cashbook")
     */
    name?: string;

    /*
     * Account currency
     */
    currency?: string;

    /*
     * When the account was created
     */
    dtCreated?: any;

    /*
     * Last operations with account (deposits, purchases or others)
     */
    history?: any;
  }