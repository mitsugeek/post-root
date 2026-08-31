(() => {
  const data = window.CHOFU_ROUTES;
  const mapElement = document.getElementById("map");
  const routeMeta = document.getElementById("routeMeta");
  const panelKicker = document.getElementById("panelKicker");
  const panelTitle = document.getElementById("panelTitle");
  const panelNote = document.getElementById("panelNote");
  const pointCount = document.getElementById("pointCount");
  const verificationSummary = document.getElementById("verificationSummary");
  const routeList = document.getElementById("routeList");
  const tabs = [...document.querySelectorAll("[data-route]")];

  if (!data || !window.L) {
    mapElement.innerHTML = '<div class="map-error">地図データを読み込めませんでした。</div>';
    return;
  }

  const map = L.map(mapElement, { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const routeLayer = L.layerGroup().addTo(map);
  const routeMarkers = new Map();
  const allPoints = Object.values(data.districts).flatMap((route) => route.points);
  const typeMeta = {
    "postbox": { label: "屋外ポスト", mark: "●" },
    "postal-office": { label: "郵便局", mark: "〒" },
    "convenience-indoor": { label: "店内ポスト", mark: "店" },
    "smari": { label: "スマリ", mark: "S" },
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function mapsUrl(point) {
    return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
  }

  function streetViewUrl(point) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.lat},${point.lng}`;
  }

  function routeIcon(point, color) {
    const meta = typeMeta[point.locationType] || typeMeta.postbox;
    return L.divIcon({
      className: "route-badge-icon",
      html: `<div class="badge badge-${escapeHtml(point.verification)}" style="--route-color:${color}">
        <span>${point.order}</span><i title="${escapeHtml(meta.label)}">${escapeHtml(meta.mark)}</i>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -17],
    });
  }

  function officeIcon() {
    return L.divIcon({
      className: "office-icon",
      html: '<div class="office-badge">〒</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -19],
    });
  }

  function scheduleMarkup(schedule) {
    return `<dl class="schedule-grid">${Object.entries(schedule)
      .map(([day, times]) => `<dt>${escapeHtml(day)}</dt><dd>${times.map(escapeHtml).join(" / ")}</dd>`)
      .join("")}</dl>`;
  }

  function pointPopup(point, district) {
    const matchedAddress = point.postmapAddress
      ? `<p class="secondary">Postmap登録住所: ${escapeHtml(point.postmapAddress)}</p>`
      : point.matchedAddress !== point.address
        ? `<p class="secondary">住所検索結果: ${escapeHtml(point.matchedAddress)}</p>`
        : "";
    const meta = typeMeta[point.locationType] || typeMeta.postbox;
    const verification = verificationMarkup(point);
    const postmapLink = point.postmapUrl
      ? `<a href="${escapeHtml(point.postmapUrl)}" target="_blank" rel="noopener">Postmap登録</a>`
      : point.inactivePostmapUrl
        ? `<a href="${escapeHtml(point.inactivePostmapUrl)}" target="_blank" rel="noopener">Postmapの撤去記録</a>`
        : "";
    return `<div class="popup">
      <h3>${escapeHtml(point.name)}</h3>
      <p><span class="type-chip type-${escapeHtml(point.locationType)}">${escapeHtml(meta.label)}</span></p>
      <p>${escapeHtml(district)}区 ${point.order}番 / 資料 No.${point.sourceRow}</p>
      <p>${escapeHtml(point.address)}</p>
      ${matchedAddress}
      ${scheduleMarkup(point.schedule)}
      ${verification}
      <p class="secondary">座標: ${escapeHtml(point.coordinateSource)}</p>
      <div class="popup-links">
        <a href="${mapsUrl(point)}" target="_blank" rel="noopener">Google Maps</a>
        <a href="${streetViewUrl(point)}" target="_blank" rel="noopener">Street View</a>
        ${postmapLink}
      </div>
    </div>`;
  }

  function verificationMarkup(point) {
    if (point.verification === "postmap-matched") {
      const checked = point.postmapCheckDate ? `（確認日 ${escapeHtml(point.postmapCheckDate)}）` : "";
      return `<p class="verification verification-ok">Postmapの現行登録と照合${checked}</p>`;
    }
    if (point.verification === "postmap-conflict") {
      return '<p class="verification verification-warning">資料には記載がありますが、Postmapでは撤去扱いです。</p>';
    }
    if (point.verification === "source-only") {
      return '<p class="verification verification-neutral">スマリは郵便ポストではありません。資料の住所代表点です。</p>';
    }
    return '<p class="verification verification-neutral">Postmapで地点を特定できず、資料の住所代表点を表示しています。</p>';
  }

  function officePopup() {
    return `<div class="popup">
      <h3>${escapeHtml(data.office.name)}</h3>
      <p>${escapeHtml(data.office.address)}</p>
      <p class="secondary">各ルートの発着点</p>
      <div class="popup-links">
        <a href="${mapsUrl(data.office)}" target="_blank" rel="noopener">Google Maps</a>
      </div>
    </div>`;
  }

  function markerPosition(point, points) {
    const duplicates = points.filter((candidate) => candidate.lat === point.lat && candidate.lng === point.lng);
    if (duplicates.length === 1) {
      return [point.lat, point.lng];
    }
    const duplicateIndex = duplicates.indexOf(point);
    const angle = (duplicateIndex / duplicates.length) * Math.PI * 2;
    const radius = 0.000055;
    return [point.lat + Math.sin(angle) * radius, point.lng + Math.cos(angle) * radius];
  }

  function addOfficeMarker() {
    L.marker([data.office.lat, data.office.lng], { icon: officeIcon(), zIndexOffset: 500 })
      .bindPopup(officePopup(), { maxWidth: 330 })
      .addTo(routeLayer);
  }

  function fit(points) {
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 16 });
    }
  }

  function weekdaySummary(point) {
    const times = point.schedule["平日"];
    return times?.length ? `平日 ${times.join(" / ")}` : "平日の時刻記載なし";
  }

  function showPoint(point, district) {
    const marker = routeMarkers.get(`${district}-${point.sourceRow}`);
    if (!marker) return;
    map.setView(marker.getLatLng(), 17, { animate: true });
    marker.openPopup();
  }

  function renderRouteList(district, route) {
    const fragment = document.createDocumentFragment();
    route.points.forEach((point) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stop-button";
      button.style.setProperty("--route-color", route.color);
      button.setAttribute("aria-label", `${point.order}番 ${point.name}を地図で表示`);
      button.innerHTML = `<span class="stop-number">${point.order}</span>
        <span class="stop-copy">
          <span class="stop-name">${escapeHtml(point.name)}</span>
          <span class="stop-tags">
            <span class="type-chip type-${escapeHtml(point.locationType)}">${escapeHtml(point.locationTypeLabel)}</span>
            <span class="status-dot status-${escapeHtml(point.verification)}">${point.verification === "postmap-matched" ? "照合済み" : "要確認"}</span>
          </span>
          <span class="stop-address">${escapeHtml(point.address.replace("東京都", ""))}</span>
          <span class="stop-times">${escapeHtml(weekdaySummary(point))}</span>
        </span>`;
      button.addEventListener("click", () => showPoint(point, district));
      item.append(button);
      fragment.append(item);
    });
    routeList.replaceChildren(fragment);
  }

  function renderOverviewList() {
    const fragment = document.createDocumentFragment();
    Object.entries(data.districts).forEach(([district, route]) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "overview-button";
      button.style.setProperty("--route-color", route.color);
      button.innerHTML = `<span class="route-swatch"></span>
        <span>
          <span class="overview-title">${district}区</span>
          <span class="overview-range">資料 No.${escapeHtml(route.sourceRows)}</span>
        </span>
        <span class="overview-count">${route.points.length}地点</span>`;
      button.addEventListener("click", () => selectRoute(district));
      item.append(button);
      fragment.append(item);
    });
    routeList.replaceChildren(fragment);
  }

  function renderOverview() {
    panelKicker.textContent = "全区";
    panelTitle.textContent = "ルート一覧";
    panelNote.textContent = "色分けした1〜9区を表示しています。区を選ぶと立寄順と予定時刻を確認できます。";
    pointCount.textContent = `${allPoints.length}地点`;
    routeMeta.textContent = `全9区 / ${allPoints.length}地点 / Postmap照合 ${data.verificationSummary.postmapMatched}地点`;

    addOfficeMarker();
    Object.values(data.districts).forEach((route) => {
      const path = [data.office, ...route.points, data.office].map((point) => [point.lat, point.lng]);
      L.polyline(path, { color: route.color, weight: 3, opacity: 0.72 })
        .bindTooltip(route.title, { sticky: true })
        .addTo(routeLayer);
      route.points.forEach((point) => {
        L.circleMarker([point.lat, point.lng], {
          radius: point.verification === "postmap-matched" ? 4 : 5,
          color: point.verification === "postmap-matched" ? "#fff" : "#172033",
          weight: point.verification === "postmap-matched" ? 1.5 : 2,
          fillColor: route.color,
          fillOpacity: point.verification === "postmap-matched" ? 1 : 0.45,
        })
          .bindTooltip(`${route.title} / ${point.order}. ${point.name}`, { sticky: true })
          .addTo(routeLayer);
      });
    });
    renderOverviewList();
    fit([data.office, ...allPoints]);
  }

  function renderDistrict(district) {
    const route = data.districts[district];
    const path = [data.office, ...route.points, data.office].map((point) => [point.lat, point.lng]);

    panelKicker.textContent = `${district}区`;
    panelTitle.textContent = "立寄地点";
    panelNote.textContent = `資料 No.${route.sourceRows}。地点を選ぶと地図上のマーカーと曜日別の予定時刻を表示します。`;
    pointCount.textContent = `${route.points.length}地点`;
    const matched = route.points.filter((point) => point.verification === "postmap-matched").length;
    routeMeta.textContent = `${district}区 / ${route.points.length}地点 / Postmap照合 ${matched}地点 / 資料 No.${route.sourceRows}`;

    L.polyline(path, {
      color: route.color,
      weight: 4,
      opacity: 0.82,
      lineJoin: "round",
    }).addTo(routeLayer);
    addOfficeMarker();

    route.points.forEach((point) => {
      const marker = L.marker(markerPosition(point, route.points), {
        icon: routeIcon(point, route.color),
      })
        .bindPopup(pointPopup(point, district), { maxWidth: 345 })
        .addTo(routeLayer);
      routeMarkers.set(`${district}-${point.sourceRow}`, marker);
    });

    renderRouteList(district, route);
    fit([data.office, ...route.points]);
  }

  function selectRoute(routeId, updateUrl = true) {
    const selected = routeId === "all" || data.districts[routeId] ? routeId : "1";
    routeLayer.clearLayers();
    routeMarkers.clear();
    tabs.forEach((tab) => {
      if (tab.dataset.route === selected) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });

    if (selected === "all") {
      renderOverview();
    } else {
      renderDistrict(selected);
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("district", selected);
      history.replaceState(null, "", url);
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectRoute(tab.dataset.route));
  });

  verificationSummary.innerHTML = `<span class="summary-item summary-ok">Postmap照合 ${data.verificationSummary.postmapMatched}</span>
    <span class="summary-item summary-neutral">住所代表点 ${data.verificationSummary.addressRepresentative}</span>
    <span class="summary-item summary-warning">撤去扱いと相違 ${data.verificationSummary.postmapConflict}</span>
    <span class="summary-item summary-smari">スマリ ${data.verificationSummary.smari}</span>`;

  if (window.PostRootLocation) {
    window.PostRootLocation.addTo(map);
  }

  const initialRoute = new URLSearchParams(window.location.search).get("district") || "1";
  selectRoute(initialRoute, false);
})();
