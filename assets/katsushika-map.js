(() => {
  const districtId = document.body.dataset.district;
  const district = window.KATSUSHIKA_SHINJUKU_ROUTES?.districts?.[districtId];
  const mapElement = document.getElementById("map");
  const metaElement = document.getElementById("routeMeta");

  if (!district || !window.L) {
    mapElement.innerHTML = '<div class="map-error">地図データを読み込めませんでした。</div>';
    return;
  }

  document.querySelector("h1").textContent = district.title;
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.dataset.district === districtId) {
      link.setAttribute("aria-current", "page");
    }
  });

  const map = L.map(mapElement, { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const layerGroup = L.layerGroup().addTo(map);

  function mapsUrl(point) {
    return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
  }

  function streetViewUrl(point) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.lat},${point.lng}`;
  }

  function postmapUrl(point) {
    return point.source.type === "postmap" && point.source.id
      ? `https://www.postmap.org/map/${point.source.id}`
      : "";
  }

  function icon(order) {
    return L.divIcon({
      className: "route-badge-icon",
      html: `<div class="badge">${order}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function popup(point) {
    const postmap = postmapUrl(point);
    const mappedAddress = point.mappedAddress
      ? `<p class="secondary">登録地点: ${escapeHtml(point.mappedAddress)}</p>`
      : "";
    const sourceClass = point.source.type === "gsi" ? "estimate" : "secondary";
    const postmapLink = postmap
      ? `<a href="${postmap}" target="_blank" rel="noopener">postmap</a>`
      : "";

    return `<div class="popup">
      <h2>${escapeHtml(point.name)}</h2>
      <p>${point.order}. ${escapeHtml(point.address)} / ${escapeHtml(point.boxType)}</p>
      <p class="secondary">写真の表 No.${point.sourceRow}</p>
      ${mappedAddress}
      <p class="${sourceClass}">${escapeHtml(point.source.label)}</p>
      <div class="links">
        <a href="${mapsUrl(point)}" target="_blank" rel="noopener">Google Maps</a>
        <a href="${streetViewUrl(point)}" target="_blank" rel="noopener">Street View</a>
        ${postmapLink}
      </div>
    </div>`;
  }

  const route = district.routes[0];
  const latLngs = route.points.map((point) => [point.lat, point.lng]);

  L.polyline(latLngs, {
    color: "#2563eb",
    weight: 4,
    opacity: 0.78,
  }).addTo(layerGroup);

  route.points.forEach((point) => {
    L.marker([point.lat, point.lng], { icon: icon(point.order) })
      .bindPopup(popup(point), { maxWidth: 330 })
      .addTo(layerGroup);
  });

  map.fitBounds(latLngs, { padding: [30, 30] });
  metaElement.textContent = `${route.label} / ${route.points.length}地点 / 表 No.${district.sourceRows}`;
})();
