import { createContext, useContext } from "react";
import { cloudAccount } from "@/platform/cloud-account";
export const CloudAccountContext = createContext(cloudAccount);
export const useCloudAccount = () => useContext(CloudAccountContext);
