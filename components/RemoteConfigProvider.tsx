import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppRemoteConfigValues,
  initRemoteConfig,
  REMOTE_CONFIG_DEFAULTS,
} from '../services/remoteConfig';

interface RemoteConfigContextValue extends AppRemoteConfigValues {
  loading: boolean;
  refresh: () => Promise<void>;
}

const RemoteConfigContext = createContext<RemoteConfigContextValue>({
  ...REMOTE_CONFIG_DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export const useRemoteConfig = () => useContext(RemoteConfigContext);

export const RemoteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [values, setValues] = useState<AppRemoteConfigValues>(REMOTE_CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await initRemoteConfig();
      setValues(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <RemoteConfigContext.Provider value={{ ...values, loading, refresh }}>
      {children}
    </RemoteConfigContext.Provider>
  );
};
