/** Row ids are made in the browser, so a new row can show on screen before the server has it. */
export const newId = (): string => crypto.randomUUID();
