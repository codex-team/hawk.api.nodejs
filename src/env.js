import { resolve } from "path";
import dotenv from "dotenv";

export default dotenv.config({ path: resolve(__dirname, "../.env") });
