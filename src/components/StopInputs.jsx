import { useMemo, useState } from "react";
import UiIcon from "./UiIcon.jsx";
import AddressAutocomplete from "./AddressAutocomplete.jsx";
import { parseBulkStops } from "../utils/bulkStops.js";

const StopInputs = ({
  className = "",
  stops,
  savedLocations,
  onStopChange,
  onAddStop,
  onRemoveStop,
  onImportStops,
  maxStops,
  t
}) => {
  const classNames = ["stop-input-group", className].filter(Boolean).join(" ");
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const bulkStops = useMemo(() => parseBulkStops(bulkText), [bulkText]);
  const filledStopCount = stops.filter((stop) => stop.postal.trim()).length;
  const appendCapacity = Math.max(maxStops - filledStopCount, 0);
  const replaceCount = Math.min(bulkStops.length, maxStops);
  const appendCount = Math.min(bulkStops.length, appendCapacity);
  const hasBulkStops = bulkStops.length > 0;
  const hasReplaceOverflow = bulkStops.length > maxStops;

  const formatText = (key, values) =>
    Object.entries(values).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      t(key)
    );

  const handleImportStops = (mode) => {
    const capacity = mode === "append" ? appendCapacity : maxStops;
    const selectedStops = bulkStops.slice(0, capacity);
    if (!selectedStops.length) {
      return;
    }

    onImportStops(selectedStops, mode);
    setBulkText("");
    setIsBulkOpen(false);
  };

  return (
    <div className={classNames} aria-label={t("stopsTitle")}>
      <button
        type="button"
        className={isBulkOpen ? "bulk-stops-launcher active" : "bulk-stops-launcher"}
        onClick={() => setIsBulkOpen((current) => !current)}
        aria-expanded={isBulkOpen}
        aria-controls="bulk-stops-panel"
      >
        <span className="bulk-stops-launcher-icon">
          <UiIcon name="paste" />
        </span>
        <span className="bulk-stops-launcher-text">
          <span>{t("pasteMultipleStops")}</span>
          <small>{t("bulkStopsLauncherHint")}</small>
        </span>
      </button>

      {isBulkOpen && (
        <section id="bulk-stops-panel" className="bulk-stops-panel" aria-label={t("bulkStopsTitle")}>
          <div className="bulk-stops-header">
            <label htmlFor="bulk-stops-input">{t("bulkStopsTitle")}</label>
            <button
              type="button"
              className="bulk-stops-close-button"
              onClick={() => setIsBulkOpen(false)}
              aria-label={t("closeBulkStops")}
            >
              <UiIcon name="close" />
            </button>
          </div>
          <textarea
            id="bulk-stops-input"
            className="bulk-stops-textarea"
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={t("bulkStopsPlaceholder")}
            rows="4"
          />
          <div className="bulk-stops-meta" aria-live="polite">
            <span>
              {hasBulkStops ? formatText("bulkStopsDetected", { count: bulkStops.length }) : t("bulkStopsEmpty")}
            </span>
            {hasReplaceOverflow && (
              <span className="bulk-stops-warning">{formatText("bulkStopsLimit", { max: maxStops })}</span>
            )}
          </div>
          <div className="bulk-stops-actions">
            {filledStopCount > 0 && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleImportStops("append")}
                disabled={appendCount === 0}
              >
                {appendCount > 0 ? formatText("bulkStopsAppendCount", { count: appendCount }) : t("bulkStopsFull")}
              </button>
            )}
            <button
              type="button"
              className="chip active"
              onClick={() => handleImportStops("replace")}
              disabled={replaceCount === 0}
            >
              {filledStopCount > 0
                ? formatText("bulkStopsReplaceCount", { count: replaceCount })
                : formatText("bulkStopsImportCount", { count: replaceCount })}
            </button>
          </div>
        </section>
      )}

      <div className="stop-inputs">
        {stops.map((stop, index) => (
          <div className="stop-input" key={stop.id}>
            <label htmlFor={`stop-${stop.id}`}>{t("stopNumber")} {index + 1}</label>
            <AddressAutocomplete
              id={`stop-${stop.id}`}
              placeholder={t("stopPostalPlaceholder")}
              value={stop.postal}
              savedLocations={savedLocations}
              onChange={(value) => onStopChange(stop.id, value)}
              t={t}
            />
            <button
              type="button"
              className="remove-stop-button"
              onClick={() => onRemoveStop(stop.id)}
              aria-label={`${t("remove")} ${t("stopNumber")} ${index + 1}`}
            >
              <UiIcon name="close" />
            </button>
          </div>
        ))}
      </div>

      <div className="stop-actions">
        <button
          type="button"
          className="add-stop-button"
          onClick={onAddStop}
          disabled={stops.length >= maxStops}
        >
          <span className="button-with-icon">
            <UiIcon name="plus" />
            <span>{t("addStop")}</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default StopInputs;
