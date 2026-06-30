import UiIcon from "./UiIcon.jsx";

const RouteList = ({
  routeStops,
  endStop,
  onToggleDelivered,
  onNavigate,
  nextStopId,
  deliveredCount,
  t
}) => {
  const stopCount = routeStops?.length || 0;
  const getDisplayAddress = (stop) => stop.address || stop.postal;

  if (!stopCount && !endStop) {
    return null;
  }

  return (
    <section className="route-panel">
      <div className="route-panel-header">
        <h2>{t("routeOrder")}</h2>
        {stopCount > 0 && (
          <span className="route-count">
            {deliveredCount}/{stopCount} {t("deliveredCount")}
          </span>
        )}
      </div>

      <ol className="route-list">
        {routeStops?.map((stop, index) => {
          const isNext = stop.id === nextStopId;
          const itemClass = stop.delivered
            ? "route-item delivered"
            : isNext
            ? "route-item next"
            : "route-item";

          return (
            <li key={stop.id} className={itemClass}>
              <span className="route-index">{index + 1}.</span>
              <div className="route-info">
                <div className="route-postal">
                  <span className="route-address-inline">{getDisplayAddress(stop)}</span>
                </div>
                {isNext && <span className="next-pill">{t("nextStop")}</span>}
                <div className="route-actions">
                  <div className="nav-group" aria-label={t("navigationApp")}>
                    <button
                      type="button"
                      className="nav-action"
                      onClick={() => onNavigate(stop, "google")}
                    >
                      <img src="/googlemaps-logo.svg" alt="" className="nav-logo" />
                      <span>{t("googleMaps")}</span>
                    </button>
                    <button
                      type="button"
                      className="nav-action"
                      onClick={() => onNavigate(stop, "waze")}
                    >
                      <img src="/waze-logo.svg" alt="" className="nav-logo" />
                      <span>{t("waze")}</span>
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={stop.delivered ? "delivered-toggle active" : "delivered-toggle"}
                onClick={() => onToggleDelivered(stop.id)}
                aria-pressed={stop.delivered}
                aria-label={stop.delivered ? t("undoDelivered") : t("markDelivered")}
              >
                <span className="delivered-toggle-mark" aria-hidden="true">
                  {stop.delivered && <UiIcon name="check" />}
                </span>
                <span className="delivered-toggle-label">
                  {stop.delivered ? t("delivered") : t("markShort")}
                </span>
              </button>
            </li>
          );
        })}
        {endStop && (
          <li className="route-item end">
            <span className="route-index end-index">{t("endLabel")}.</span>
            <div className="route-info">
              <div className="route-postal">
                <span className="route-address-inline">{getDisplayAddress(endStop)}</span>
              </div>
              <div className="route-actions">
                <div className="nav-group" aria-label={t("navigationApp")}>
                  <button
                    type="button"
                    className="nav-action"
                    onClick={() => onNavigate(endStop, "google")}
                  >
                    <img src="/googlemaps-logo.svg" alt="" className="nav-logo" />
                    <span>{t("googleMaps")}</span>
                  </button>
                  <button
                    type="button"
                    className="nav-action"
                    onClick={() => onNavigate(endStop, "waze")}
                  >
                    <img src="/waze-logo.svg" alt="" className="nav-logo" />
                    <span>{t("waze")}</span>
                  </button>
                </div>
              </div>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
};

export default RouteList;
