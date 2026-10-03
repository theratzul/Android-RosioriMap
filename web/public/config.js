/* Runtime configuration. Overridden in Kubernetes via ConfigMap and on Android via the native bridge. */
window.ROSIORI_CONFIG = window.ROSIORI_CONFIG || {
  // Empty = same origin (web deployment). Android sets this to the cluster URL from settings.
  apiBase: '',
  center: [44.1105, 24.9925],
  zoom: 15,
  tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};
