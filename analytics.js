let map;
        let pinMarkers = [];

        const locations = [
            { name: "Bengaluru Central", lat: 12.9716, lng: 77.5946, risk: "High Risk", cases: 42 },
            { name: "Mysuru East District", lat: 12.2958, lng: 76.6394, risk: "Elevated Risk", cases: 18 },
            { name: "Mangaluru Coastal Node", lat: 12.9141, lng: 74.8560, risk: "Monitored Zone", cases: 12 },
            { name: "Hubballi Junction Sector", lat: 15.3647, lng: 75.1240, risk: "Moderate Risk", cases: 9 }
        ];

        document.addEventListener("DOMContentLoaded", () => {
            map = L.map('map').setView([12.9716, 77.5946], 7);

            // Light-mode Map Tiles (CartoDB Voyager)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);

            locations.forEach(loc => {
                const marker = L.circleMarker([loc.lat, loc.lng], {
                    color: '#990011',
                    fillColor: '#990011',
                    fillOpacity: 0.75,
                    radius: 10
                }).addTo(map);

                marker.bindPopup(`
                    <div style="color: #2A080C; font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 0.95rem;">${loc.name}</strong><br>
                        <span style="font-size: 0.8rem; color: #990011; font-weight: bold;">Status: ${loc.risk}</span><br>
                        <span style="font-size: 0.8rem;">Active Logs: ${loc.cases} cases</span>
                    </div>
                `);

                pinMarkers.push(marker);
            });
        });

        function toggleLayer(type) {
            document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
            if (type === 'heatmap') {
                document.getElementById('btnHeatmap').classList.add('active');
                map.setView([12.9716, 77.5946], 7);
            } else if (type === 'pins') {
                document.getElementById('btnPins').classList.add('active');
                map.setView([12.9716, 77.5946], 10);
            } else if (type === 'patrol') {
                document.getElementById('btnPatrol').classList.add('active');
                map.setView([12.5, 76.0], 8);
            }
            showToast(`GIS Layer switched to ${type.toUpperCase()}`, "info");
        }

        function selectFeature(type) {
            document.querySelectorAll('.feature-interactive').forEach(el => el.classList.remove('active'));
            const outputText = document.getElementById('featureOutputText');

            if (type === 'pattern') {
                document.getElementById('card-pattern').classList.add('active');
                outputText.innerHTML = "<strong>Pattern Discovery:</strong> Identified 3 temporal clusters in Bengaluru North and Mysuru sectors over the past 24 hours.";
            } else if (type === 'network') {
                document.getElementById('card-network').classList.add('active');
                outputText.innerHTML = "<strong>Network Analysis:</strong> Generated visual linkage map for Syndicate #04. Identified 2 central hubs connecting local nodes.";
            } else if (type === 'predictive') {
                document.getElementById('card-predictive').classList.add('active');
                outputText.innerHTML = "<strong>Predictive Analytics:</strong> High probability forecast generated for late-night commercial sectors (Peak 01:00 AM - 04:00 AM).";
            }
        }

        function updateTimeframe(val) { showToast(`Timeframe updated: Past ${val}`, "info"); }
        function refreshData() { showToast("Syncing spatial GIS layers with incident servers...", "success"); }