/**
 * MSW server for Jest (Node.js environment).
 *
 * Started/stopped automatically in jest.setup.ts.
 * Per-test overrides: import { server } from "../mocks/server" and call
 * server.use(http.get(...)) inside the test.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
