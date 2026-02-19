import UiIcon from "./UiIcon.jsx";

const StopInputs = ({ className = "", stops, onStopChange, onAddStop, onRemoveStop, maxStops, t }) => {
  const cardClassName = `card ${className}`.trim();

  return (
    <div className={cardClassName} aria-label={t("stopsTitle")}>
      <div className="card-title-row">
        <h2 className="title-with-icon">
          <UiIcon name="stops" />
          <span>{t("stopsTitle")}</span>
        </h2>
        <span className="badge">
          {t("stopCount")}: {stops.length} / {maxStops}
        </span>
      </div>

      <div className="stop-inputs">
        {stops.map((stop, index) => (
          <div className="stop-input" key={stop.id}>
            <label htmlFor={`stop-${stop.id}`}>{t("stopNumber")} {index + 1}</label>
            <div className="input-row">
              <input
                id={`stop-${stop.id}`}
                type="text"
                inputMode="text"
                placeholder={t("stopPostalPlaceholder")}
                value={stop.postal}
                onChange={(event) => onStopChange(stop.id, event.target.value)}
              />
              <button
                type="button"
                className="ghost-button"
                onClick={() => onRemoveStop(stop.id)}
                aria-label={`${t("remove")} ${t("stopNumber")} ${index + 1}`}
              >
                {t("remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="primary-button add-stop"
        onClick={onAddStop}
        disabled={stops.length >= maxStops}
      >
        <span className="button-with-icon">
          <UiIcon name="plus" />
          <span>{t("addStop")}</span>
        </span>
      </button>
    </div>
  );
};

export default StopInputs;
