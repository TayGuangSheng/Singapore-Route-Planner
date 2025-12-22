const RouteList = ({
  routeStops,
  endStop,
  onToggleDelivered,
  onNavigate,
  nextStopId,
  deliveredCount,
  t
}) => {
  if (!routeStops?.length) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <h2>{t("routeOrder")}</h2>
        <div className="stat-chips">
          <span className="badge">
            {t("deliveredCount")}: {deliveredCount}
          </span>
          <span className="badge">
            {t("remainingCount")}: {routeStops.length - deliveredCount}
          </span>
        </div>
      </div>

      <div className="route-list">
        {routeStops.map((stop, index) => {
          const isNext = stop.id === nextStopId;
          const itemClass = stop.delivered
            ? "route-item delivered"
            : isNext
            ? "route-item next"
            : "route-item";

          return (
            <div key={stop.id} className={itemClass}>
              <div className="route-index">{index + 1}</div>
              <div className="route-info">
                <div className="route-postal">
                  {stop.postal}
                  {isNext && <span className="next-pill">{t("nextStop")}</span>}
                </div>
                {stop.address && <div className="route-address">{stop.address}</div>}
                <div className="route-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onNavigate(stop)}
                  >
                    {t("navigate")}
                  </button>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={stop.delivered}
                      onChange={() => onToggleDelivered(stop.id)}
                    />
                    <span>{t("delivered")}</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
        {endStop && (
          <div className="route-item end">
            <div className="route-index end-index">{t("endLabel")}</div>
            <div className="route-info">
              <div className="route-postal">{endStop.postal}</div>
              {endStop.address && <div className="route-address">{endStop.address}</div>}
              <div className="route-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onNavigate(endStop)}
                >
                  {t("navigate")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteList;
