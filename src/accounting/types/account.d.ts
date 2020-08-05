export interface Account {
    /**
     * Account id
     */
    id: string;

    /**
     * Account name (for example, "Cashbook")
     */
    name?: string;

    /**
     * Account currency
     */
    currency?: string;

    /**
     * Account balance
     */
    balance?: number;
  }