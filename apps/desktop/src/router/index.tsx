import { useRoutes } from "react-router-dom";
import routes from "./config";

export function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}
