import UiIcon from './UiIcon.jsx';

const SavedLocations = ({
  className = '',
  savedLocations,
  savedLocationName,
  savedLocationValue,
  onSavedLocationNameChange,
  onSavedLocationValueChange,
  onAddSavedLocation,
  onUseForStart,
  onUseForEnd,
  onRemoveSavedLocation,
  t
}) => {
  const handleSubmit = (event) => {
    event.preventDefault();
    onAddSavedLocation();
  };

  const cardClassName = `card ${className}`.trim();

  return (
    <section className={cardClassName} aria-label={t('savedLocationsTitle')}>
      <div className="card-title-row">
        <h2 className="title-with-icon">
          <UiIcon name="saved" />
          <span>{t('savedLocationsTitle')}</span>
        </h2>
        <span className="badge">
          {savedLocations.length} {t('savedCountLabel')}
        </span>
      </div>

      <form className="saved-form" onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="text"
          placeholder={t('savedNamePlaceholder')}
          value={savedLocationName}
          onChange={(event) => onSavedLocationNameChange(event.target.value)}
          aria-label={t('savedNameLabel')}
        />
        <input
          type="text"
          inputMode="text"
          placeholder={t('savedValuePlaceholder')}
          value={savedLocationValue}
          onChange={(event) => onSavedLocationValueChange(event.target.value)}
          aria-label={t('savedValueLabel')}
        />
        <button type="submit" className="primary-button">
          <span className="button-with-icon">
            <UiIcon name="plus" />
            <span>{t('saveLocation')}</span>
          </span>
        </button>
      </form>

      {!savedLocations.length ? (
        <p className="hint">{t('savedEmpty')}</p>
      ) : (
        <div className="saved-list">
          {savedLocations.map((location) => (
            <div className="saved-item" key={location.id}>
              <div className="saved-meta">
                <p className="saved-name">{location.name}</p>
                <p className="saved-value">{location.value}</p>
              </div>
              <div className="saved-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onUseForStart(location.id)}
                >
                  {t('useForStart')}
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onUseForEnd(location.id)}
                >
                  {t('useForEnd')}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onRemoveSavedLocation(location.id)}
                >
                  {t('remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default SavedLocations;
