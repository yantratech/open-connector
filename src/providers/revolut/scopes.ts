export const revolutReadScope = "READ";
export const revolutWriteScope = "WRITE";

/** PAY is deliberately absent: this provider can prepare drafts but cannot move money. */
export const revolutOAuthScopes: string[] = [revolutReadScope, revolutWriteScope];
