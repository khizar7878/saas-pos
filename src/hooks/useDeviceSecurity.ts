import { useEffect } from "react";

// Placeholder hook - device security is disabled
export const useDeviceSecurity = () => {
    return {
        isDeviceVerified: true,
        isLoading: false,
        error: null,
        deviceId: "disabled",
        deviceName: "disabled"
    };
};
