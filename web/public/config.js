/* Runtime configuration. Overridden in Kubernetes via ConfigMap and on Android via the native bridge. */
window.ROSIORI_CONFIG = window.ROSIORI_CONFIG || {
  // Empty = same origin (web deployment). Android sets this to the cluster URL from settings.
  apiBase: '',
  center: [44.1105, 24.9925],
  zoom: 15,
  // OpenStreetMap standard tile provider does not require any API key.
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  tileProviders: {
    osm: {
      name: 'OpenStreetMap (Gratuit, fără API key)',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19
    },
    opentopo: {
      name: 'OpenTopoMap (Topografic)',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; OpenTopoMap',
      maxZoom: 17
    },
    carto: {
      name: 'CARTO Voyager',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }
  }
};

