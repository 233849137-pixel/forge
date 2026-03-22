"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  ForgeModelProviderId,
  ForgeModelProviderSetting
} from "../../packages/core/src/types";
import {
  fetchForgeModelProviders,
  saveForgeModelProvider,
  testForgeModelProviderConnection
} from "../lib/forge-model-provider-api";
import { dispatchForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import shellStyles from "./forge-console-shell.module.css";
import ForgeEditDialog from "./forge-edit-dialog";
import styles from "./forge-system-settings.module.css";

type ForgeSystemSettingsProps = {
  open: boolean;
  onClose: () => void;
};

type ProviderDraft = {
  enabled: boolean;
  apiKey: string;
  modelPriority: string[];
  nextModel: string;
  showApiKey: boolean;
};

const refreshViews = [
  "home",
  "projects",
  "team",
  "artifacts",
  "assets",
  "execution",
  "governance"
] as const;

const providerAvatarMap: Record<ForgeModelProviderId, string> = {
  kimi: "K",
  "kimi-coding": "KC",
  openai: "O",
  anthropic: "A",
  google: "G"
};

const providerGuideMap: Record<
  ForgeModelProviderId,
  {
    apiKeyLabel: string;
  }
> = {
  kimi: {
    apiKeyLabel: "Moonshot Kimi API 密钥"
  },
  "kimi-coding": {
    apiKeyLabel: "Kimi Coding API 密钥"
  },
  openai: {
    apiKeyLabel: "OpenAI API 密钥"
  },
  anthropic: {
    apiKeyLabel: "Anthropic API 密钥"
  },
  google: {
    apiKeyLabel: "Google Gemini API 密钥"
  }
};

function createProviderDraft(provider: ForgeModelProviderSetting): ProviderDraft {
  return {
    enabled: provider.enabled,
    apiKey: "",
    modelPriority: [...provider.modelPriority],
    nextModel: "",
    showApiKey: false
  };
}

function getProviderStatusLabel(provider: ForgeModelProviderSetting) {
  if (provider.status === "success") {
    return "已连接";
  }

  if (provider.status === "error") {
    return "连接失败";
  }

  if (provider.enabled && provider.hasApiKey) {
    return "已配置";
  }

  return "未配置";
}

export default function ForgeSystemSettings({
  open,
  onClose
}: ForgeSystemSettingsProps) {
  const [providers, setProviders] = useState<ForgeModelProviderSetting[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<ForgeModelProviderId>("kimi");
  const [drafts, setDrafts] = useState<Partial<Record<ForgeModelProviderId, ProviderDraft>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warn" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFeedback(null);

    fetchForgeModelProviders()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setProviders(result.providers);
        setDrafts((current) => {
          const nextDrafts = { ...current };

          result.providers.forEach((provider) => {
            nextDrafts[provider.id] = current[provider.id] ?? createProviderDraft(provider);
          });

          return nextDrafts;
        });

        if (!result.providers.some((provider) => provider.id === selectedProviderId)) {
          setSelectedProviderId(result.providers[0]?.id ?? "kimi");
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setFeedback({
          tone: "warn",
          message: error instanceof Error ? error.message : "模型设置加载失败"
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedProviderId]);

  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null;
  const selectedDraft =
    (selectedProvider && drafts[selectedProvider.id]) ||
    (selectedProvider ? createProviderDraft(selectedProvider) : null);
  const primaryModel =
    selectedDraft?.modelPriority[0] ??
    selectedProvider?.modelPriority[0] ??
    selectedProvider?.defaultModelPriority?.[0] ??
    "";
  const canSave = Boolean(selectedProvider && selectedDraft);
  const canTest =
    Boolean(selectedProvider && selectedDraft) &&
    Boolean(selectedDraft?.apiKey.trim() || selectedProvider?.hasApiKey);
  const providerGuide = selectedProvider ? providerGuideMap[selectedProvider.id] : null;
  const activeStatusText = useMemo(() => {
    if (!selectedProvider) {
      return "";
    }

    if (selectedProvider.lastTestMessage) {
      return selectedProvider.lastTestMessage;
    }

    return selectedProvider.summary;
  }, [selectedProvider]);

  const updateSelectedDraft = (updater: (draft: ProviderDraft) => ProviderDraft) => {
    if (!selectedProvider || !selectedDraft) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [selectedProvider.id]: updater(selectedDraft)
    }));
  };

  const replaceProvider = (provider: ForgeModelProviderSetting) => {
    setProviders((current) => {
      const nextProviders = current.some((item) => item.id === provider.id)
        ? current.map((item) => (item.id === provider.id ? provider : item))
        : [...current, provider];

      return nextProviders;
    });
    setDrafts((current) => ({
      ...current,
      [provider.id]: {
        enabled: provider.enabled,
        apiKey: "",
        modelPriority: [...provider.modelPriority],
        nextModel: current[provider.id]?.nextModel ?? "",
        showApiKey: current[provider.id]?.showApiKey ?? false
      }
    }));
  };

  const handleAddModel = () => {
    if (!selectedDraft) {
      return;
    }

    const nextModel = selectedDraft.nextModel.trim();
    if (!nextModel) {
      return;
    }

    updateSelectedDraft((draft) => ({
      ...draft,
      nextModel: "",
      modelPriority: Array.from(new Set([...draft.modelPriority, nextModel]))
    }));
  };

  const handleAddCatalogModel = (model: string) => {
    updateSelectedDraft((draft) => ({
      ...draft,
      modelPriority: Array.from(new Set([...draft.modelPriority, model]))
    }));
  };

  const handleRemoveModel = (model: string) => {
    updateSelectedDraft((draft) => ({
      ...draft,
      modelPriority: draft.modelPriority.filter((item) => item !== model)
    }));
  };

  const handleSave = async () => {
    if (!selectedProvider || !selectedDraft) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const result = await saveForgeModelProvider({
        providerId: selectedProvider.id,
        enabled: selectedDraft.enabled,
        apiKey: selectedDraft.apiKey.trim() || undefined,
        modelPriority: selectedDraft.modelPriority
      });

      replaceProvider(result.provider);
      dispatchForgePageContractRefresh([...refreshViews]);
      setFeedback({
        tone: "success",
        message: `${result.provider.label} 配置已保存到本机。`
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        message: error instanceof Error ? error.message : "模型设置保存失败"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !selectedDraft) {
      return;
    }

    setIsTesting(true);
    setFeedback(null);

    try {
      const result = await testForgeModelProviderConnection({
        providerId: selectedProvider.id,
        apiKey: selectedDraft.apiKey.trim() || undefined,
        model: primaryModel
      });

      replaceProvider(result.provider);
      dispatchForgePageContractRefresh([...refreshViews]);
      setFeedback({
        tone: result.connection.status === "success" ? "success" : "warn",
        message: result.connection.message
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        message: error instanceof Error ? error.message : "模型连接测试失败"
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <ForgeEditDialog
      ariaLabel="系统设置"
      bodyClassName={styles.body}
      closeLabel="关闭系统设置"
      dialogClassName={styles.dialog}
      eyebrow="本机模型配置"
      onClose={onClose}
      title="系统设置"
      footer={
        <>
          <button className={shellStyles.secondaryButton} onClick={onClose} type="button">
            关闭
          </button>
          <button
            className={shellStyles.secondaryButton}
            disabled={!canTest || isTesting}
            onClick={handleTest}
            type="button"
          >
            {isTesting ? "测试中..." : "测试连接"}
          </button>
          <button
            className={shellStyles.primaryButton}
            disabled={!canSave || isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "保存中..." : "保存配置"}
          </button>
        </>
      }
    >
      <div className={styles.layout}>
        <aside className={styles.providerRail}>
          <div className={styles.providerRailHead}>
            <p className={shellStyles.eyebrow}>供应商</p>
            <button className={styles.providerAddButton} disabled type="button">
              + 更多模型后续开放
            </button>
          </div>
          <div className={styles.providerList}>
            {providers.map((provider) => (
              <button
                aria-pressed={provider.id === selectedProviderId}
                className={`${styles.providerListItem} ${
                  provider.id === selectedProviderId ? styles.providerListItemActive : ""
                }`}
                key={provider.id}
                onClick={() => setSelectedProviderId(provider.id)}
                type="button"
              >
                <span className={styles.providerAvatar}>{providerAvatarMap[provider.id] ?? "M"}</span>
                <span className={styles.providerMeta}>
                  <strong>{provider.label}</strong>
                  <small>{provider.vendor}</small>
                </span>
                <span className={`${shellStyles.badge} ${shellStyles.badgeNeutral}`}>
                  {getProviderStatusLabel(provider)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.providerDetail}>
          {isLoading ? (
            <div className={styles.loadingState}>正在加载本机模型配置...</div>
          ) : selectedProvider && selectedDraft ? (
            <>
              <div className={styles.providerHeader}>
                <div>
                  <p className={shellStyles.eyebrow}>模型供应商</p>
                  <h3>{selectedProvider.label}</h3>
                  <p className={styles.providerSummary}>{selectedProvider.summary}</p>
                </div>
                <a
                  className={styles.docsLink}
                  href={selectedProvider.docsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  获取 API 密钥
                </a>
              </div>

              <label className={styles.toggleRow}>
                <span>启用 {selectedProvider.label}</span>
                <input
                  checked={selectedDraft.enabled}
                  onChange={(event) =>
                    updateSelectedDraft((draft) => ({
                      ...draft,
                      enabled: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
              </label>

              <label className={styles.field}>
                <span>API 密钥</span>
                <div className={styles.secretField}>
                  <input
                    autoComplete="off"
                    onChange={(event) =>
                      updateSelectedDraft((draft) => ({
                        ...draft,
                        apiKey: event.target.value
                      }))
                    }
                    placeholder={
                      selectedProvider.hasApiKey
                        ? `已在本机保存 ${selectedProvider.apiKeyHint ?? "密钥"}，重新输入可覆盖`
                        : `输入 ${providerGuide?.apiKeyLabel ?? "API 密钥"}`
                    }
                    type={selectedDraft.showApiKey ? "text" : "password"}
                    value={selectedDraft.apiKey}
                  />
                  <button
                    aria-label={selectedDraft.showApiKey ? "隐藏 API 密钥" : "显示 API 密钥"}
                    className={styles.secretToggle}
                    onClick={() =>
                      updateSelectedDraft((draft) => ({
                        ...draft,
                        showApiKey: !draft.showApiKey
                      }))
                    }
                    type="button"
                  >
                    {selectedDraft.showApiKey ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>

              <div className={styles.field}>
                <span>模型优先级</span>
                <div className={styles.modelList}>
                  {selectedDraft.modelPriority.map((model, index) => (
                    <div className={styles.modelTag} key={model}>
                      <span className={styles.modelIndex}>{index + 1}</span>
                      <strong>{model}</strong>
                      <button
                        aria-label={`移除 ${model}`}
                        className={styles.modelRemove}
                        onClick={() => handleRemoveModel(model)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className={styles.modelInputRow}>
                  <input
                    onChange={(event) =>
                      updateSelectedDraft((draft) => ({
                        ...draft,
                        nextModel: event.target.value
                      }))
                    }
                    placeholder="例如 kimi-latest"
                    value={selectedDraft.nextModel}
                  />
                  <button className={shellStyles.secondaryButton} onClick={handleAddModel} type="button">
                    添加模型
                  </button>
                </div>
                {(selectedProvider.catalogModels ?? []).length > 0 ? (
                  <div className={styles.catalogSection}>
                    <span className={styles.catalogLabel}>供应商目录</span>
                    <div className={styles.catalogList}>
                      {(selectedProvider.catalogModels ?? []).map((model) => {
                        const alreadySelected = selectedDraft.modelPriority.includes(model);

                        return (
                          <button
                            className={styles.catalogModelButton}
                            disabled={alreadySelected}
                            key={model}
                            onClick={() => handleAddCatalogModel(model)}
                            type="button"
                          >
                            {alreadySelected ? `已添加 · ${model}` : `加入优先级 · ${model}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <p className={styles.modelHint}>
                  当前测试模型：{primaryModel}。保存后，项目工作台会把这些模型加入可选项。
                </p>
              </div>

              <div className={styles.statusCard}>
                <p className={shellStyles.eyebrow}>连接状态</p>
                <strong>{getProviderStatusLabel(selectedProvider)}</strong>
                <p>{activeStatusText}</p>
                {selectedProvider.lastTestedAt ? (
                  <small>最近测试：{selectedProvider.lastTestedAt}</small>
                ) : null}
              </div>

              {feedback ? (
                <div
                  className={`${styles.feedback} ${
                    feedback.tone === "success"
                      ? styles.feedbackSuccess
                      : feedback.tone === "warn"
                        ? styles.feedbackWarn
                        : styles.feedbackInfo
                  }`}
                >
                  {feedback.message}
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.loadingState}>当前还没有可配置的模型供应商。</div>
          )}
        </section>
      </div>
    </ForgeEditDialog>
  );
}
