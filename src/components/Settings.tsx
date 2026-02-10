import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Icon } from "@iconify-icon/react";
import { invoke } from "@tauri-apps/api/core";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { settings, updateSettings } = useAppStore();
  const [formData, setFormData] = useState(settings);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
    }
  }, [isOpen, settings]);

  const handleSave = async () => {
    // Update local state
    updateSettings(formData);

    // Save to backend database for translation settings
    try {
      await invoke("set_app_setting", {
        key: "translation_base_url",
        value: formData.baseUrl,
      });
      await invoke("set_app_setting", {
        key: "translation_api_key",
        value: formData.apiKey,
      });
      await invoke("set_app_setting", {
        key: "translation_model",
        value: formData.model,
      });
      await invoke("set_app_setting", {
        key: "translation_prompt",
        value: formData.prompt,
      });
    } catch (e) {
      console.error("Failed to save settings to backend:", e);
    }

    onClose();
  };

  const handleReset = async () => {
    const defaultSettings = {
      apiKey: "",
      baseUrl: "https://libretranslate.com",
      model: "gpt-3.5-turbo",
      prompt: "Translate the following text to Chinese:",
    };
    setFormData(defaultSettings);
    updateSettings(defaultSettings);

    // Also reset backend settings
    try {
      await invoke("set_app_setting", {
        key: "translation_base_url",
        value: defaultSettings.baseUrl,
      });
      await invoke("set_app_setting", {
        key: "translation_api_key",
        value: defaultSettings.apiKey,
      });
      await invoke("set_app_setting", {
        key: "translation_model",
        value: defaultSettings.model,
      });
      await invoke("set_app_setting", {
        key: "translation_prompt",
        value: defaultSettings.prompt,
      });
    } catch (e) {
      console.error("Failed to reset settings in backend:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Icon icon="mdi:cog" className="text-xl" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Translation Settings Section */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Icon icon="mdi:translate" className="text-primary" />
              Translation Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Configure the translation service. Default uses LibreTranslate
              public API.
            </p>

            <div className="space-y-4">
              {/* API Base URL */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Translation API Base URL
                </label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, baseUrl: e.target.value })
                  }
                  placeholder="https://libretranslate.com"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The base URL of your translation service
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder="Enter your API key"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Required for some translation services
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Model Name
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                  placeholder="gpt-3.5-turbo"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Model name for OpenAI-compatible APIs (e.g., gpt-3.5-turbo,
                  gpt-4, claude-3-sonnet)
                </p>
              </div>

              {/* Translation Prompt */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Translation Prompt
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) =>
                    setFormData({ ...formData, prompt: e.target.value })
                  }
                  placeholder="Translate the following text to Chinese:"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The prompt sent to the translation service
                </p>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-border">
            <button
              onClick={handleReset}
              className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <Icon icon="mdi:refresh" />
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
