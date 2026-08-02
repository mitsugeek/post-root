(function (window) {
  "use strict";

  if (!window.L) {
    return;
  }

  var L = window.L;
  var INSTANCE_KEY = "_postRootCurrentLocation";

  function errorMessage(code) {
    switch (code) {
      case 1:
        return "位置情報の利用が許可されていません。ブラウザまたは端末の設定をご確認ください。";
      case 2:
        return "現在地を取得できませんでした。端末の位置情報を有効にして、屋外などで再度お試しください。";
      case 3:
        return "現在地の取得がタイムアウトしました。もう一度お試しください。";
      default:
        return "現在地を取得できませんでした。もう一度お試しください。";
    }
  }

  function addTo(map) {
    if (!map || typeof map.setView !== "function") {
      return null;
    }

    if (map[INSTANCE_KEY]) {
      return map[INSTANCE_KEY];
    }

    var button;
    var statusElement;
    var statusTimer;
    var locationMarker;
    var accuracyCircle;
    var pending = false;
    var removed = false;
    var requestId = 0;

    function clearStatusTimer() {
      if (statusTimer) {
        window.clearTimeout(statusTimer);
        statusTimer = null;
      }
    }

    function hideStatus() {
      if (!statusElement) {
        return;
      }

      statusElement.classList.remove("is-visible", "is-error");
    }

    function showStatus(message, type, hideAfter) {
      if (!statusElement) {
        return;
      }

      clearStatusTimer();
      statusElement.textContent = message;
      statusElement.classList.toggle("is-error", type === "error");
      statusElement.classList.add("is-visible");

      if (hideAfter) {
        statusTimer = window.setTimeout(hideStatus, hideAfter);
      }
    }

    function setPending(value) {
      pending = value;

      if (!button) {
        return;
      }

      button.disabled = value;
      button.classList.toggle("is-loading", value);
      button.setAttribute("aria-busy", value ? "true" : "false");
    }

    function targetZoom() {
      var currentZoom = Number(map.getZoom());
      var maximumZoom = Number(map.getMaxZoom());
      var zoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 16) : 16;

      return Number.isFinite(maximumZoom) ? Math.min(zoom, maximumZoom) : zoom;
    }

    function locationIcon() {
      return L.divIcon({
        className: "post-root-location-marker",
        html: '<span class="post-root-location-dot" aria-hidden="true"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
      });
    }

    function updateLocation(event) {
      var accuracy = Math.max(0, Number(event.accuracy) || 0);
      var roundedAccuracy = Math.round(accuracy);
      var popupText = "<strong>現在地</strong><br>精度 約" + roundedAccuracy + " m";

      if (accuracyCircle) {
        accuracyCircle.setLatLng(event.latlng);
        accuracyCircle.setRadius(accuracy);
      } else {
        accuracyCircle = L.circle(event.latlng, {
          radius: accuracy,
          color: "#2563eb",
          weight: 1,
          opacity: 0.55,
          fillColor: "#3b82f6",
          fillOpacity: 0.14,
          interactive: false,
        }).addTo(map);
      }

      if (locationMarker) {
        locationMarker.setLatLng(event.latlng);
        locationMarker.setPopupContent(popupText);
      } else {
        locationMarker = L.marker(event.latlng, {
          icon: locationIcon(),
          title: "現在地",
          alt: "現在地",
          keyboard: true,
          zIndexOffset: 1000,
        }).bindPopup(popupText).addTo(map);
      }

      var reducedMotion = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      map.setView(event.latlng, targetZoom(), { animate: !reducedMotion });
    }

    function onLocationFound(event) {
      if (!pending || removed) {
        return;
      }

      setPending(false);
      updateLocation(event);

      var accuracy = Math.max(0, Math.round(Number(event.accuracy) || 0));
      showStatus("現在地を表示しました（精度 約" + accuracy + " m）", "success", 5000);
      button.setAttribute("aria-label", "現在地を更新");
      button.setAttribute("title", "現在地を更新");
    }

    function onLocationError(event) {
      if (!pending || removed) {
        return;
      }

      setPending(false);
      showStatus(errorMessage(event && event.code), "error", 9000);
    }

    function locate() {
      if (pending || removed) {
        return;
      }

      if (window.isSecureContext === false) {
        showStatus("現在地はHTTPSで開いたページで利用できます。", "error", 9000);
        return;
      }

      if (!window.navigator
        || !window.navigator.geolocation
        || typeof window.navigator.geolocation.getCurrentPosition !== "function") {
        showStatus("このブラウザでは位置情報を利用できません。", "error", 9000);
        return;
      }

      setPending(true);
      showStatus("現在地を取得しています…", "progress");

      var activeRequestId = ++requestId;

      try {
        window.navigator.geolocation.getCurrentPosition(
          function (position) {
            if (removed || activeRequestId !== requestId) {
              return;
            }

            onLocationFound({
              latlng: L.latLng(position.coords.latitude, position.coords.longitude),
              accuracy: position.coords.accuracy,
            });
          },
          function (error) {
            if (removed || activeRequestId !== requestId) {
              return;
            }

            onLocationError(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 15000,
          },
        );
      } catch (error) {
        setPending(false);
        showStatus("現在地を取得できませんでした。もう一度お試しください。", "error", 9000);
      }
    }

    function onButtonClick(event) {
      L.DomEvent.preventDefault(event);
      L.DomEvent.stopPropagation(event);
      locate();
    }

    var locationControl = L.control({ position: "topright" });
    locationControl.onAdd = function () {
      var container = L.DomUtil.create("div", "leaflet-bar post-root-location-control");
      button = L.DomUtil.create("button", "post-root-location-button", container);
      button.type = "button";
      button.setAttribute("aria-label", "現在地を表示");
      button.setAttribute("title", "現在地を表示");
      button.setAttribute("aria-busy", "false");
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        + '<circle cx="12" cy="12" r="3"></circle>'
        + '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>'
        + '<circle cx="12" cy="12" r="7"></circle>'
        + "</svg>";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(button, "click", onButtonClick);
      return container;
    };

    locationControl.onRemove = function () {
      removed = true;
      requestId += 1;
      clearStatusTimer();

      if (button) {
        L.DomEvent.off(button, "click", onButtonClick);
      }

      if (locationMarker && map.hasLayer(locationMarker)) {
        map.removeLayer(locationMarker);
      }

      if (accuracyCircle && map.hasLayer(accuracyCircle)) {
        map.removeLayer(accuracyCircle);
      }

      delete map[INSTANCE_KEY];
    };

    var statusControl = L.control({ position: "bottomleft" });
    statusControl.onAdd = function () {
      statusElement = L.DomUtil.create("div", "post-root-location-status");
      statusElement.setAttribute("role", "status");
      statusElement.setAttribute("aria-live", "polite");
      statusElement.setAttribute("aria-atomic", "true");
      return statusElement;
    };

    statusControl.addTo(map);
    locationControl.addTo(map);

    var instance = {
      locate: locate,
      remove: function () {
        locationControl.remove();
        statusControl.remove();
      },
    };

    map[INSTANCE_KEY] = instance;
    return instance;
  }

  window.PostRootLocation = {
    addTo: addTo,
  };
})(window);
