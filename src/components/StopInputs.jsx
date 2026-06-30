import UiIcon from "./UiIcon.jsx";
import AddressAutocomplete from "./AddressAutocomplete.jsx";

const StopInputs = ({
  className = "",
  stops,
  savedLocations,
  onStopChange,
  onAddStop,
  onRemoveStop,
  maxStops,
  t
}) => {
  const classNames = ["stop-input-group", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} aria-label={t("stopsTitle")}>
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
  );
};

export default StopInputs;
