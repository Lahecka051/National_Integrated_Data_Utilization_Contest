import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import type { FacilityVisit } from '../../types'
import { fetchRoute, type RouteSegment } from '../../utils/api'
import { Colors } from '../../utils/colors'

const TYPE_MARKER_COLORS: Record<string, string> = {
  '민원실': '#3b82f6', '은행': '#f59e0b', '우체국': '#22c55e',
}
const SEGMENT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6']
const START_LAT = 35.5396
const START_LNG = 129.3114

export interface KakaoMapHandle {
  focusOn: (lat: number, lng: number, level?: number) => void
}

interface Props {
  visits: FacilityVisit[]
  kakaoApiKey?: string
}

function formatDistance(m: number) { return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km` }
function formatDuration(s: number) {
  if (s < 60) return `${s}초`
  const min = Math.floor(s / 60)
  return min + '분'
}

const KakaoMapWebView = forwardRef<KakaoMapHandle, Props>(({ visits, kakaoApiKey = '85d0cd1983b1623822c390c9ac80f1ac' }, ref) => {
  const webViewRef = useRef<WebView>(null)
  const [segments, setSegments] = useState<RouteSegment[]>([])
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (visits.length === 0) return
    const coords = visits.map(v => ({ lat: v.facility.lat, lng: v.facility.lng }))
    fetchRoute(coords).then(d => setSegments(d.segments)).catch(() => setSegments([]))
  }, [visits])

  useEffect(() => {
    if (!mapReady || visits.length === 0) return
    const markers = visits.map((v, i) => ({
      lat: v.facility.lat, lng: v.facility.lng,
      label: String(i + 1), color: TYPE_MARKER_COLORS[v.facility.type] || '#3b82f6',
    }))
    const js = `
      updateMarkers(${JSON.stringify(markers)});
      ${segments.length > 0 ? `drawPolylines(${JSON.stringify(segments)});` : `drawSimpleLine(${JSON.stringify(visits.map(v => ({ lat: v.facility.lat, lng: v.facility.lng })))});`}
      fitBounds();
      true;
    `
    webViewRef.current?.injectJavaScript(js)
  }, [mapReady, visits, segments])

  useImperativeHandle(ref, () => ({
    focusOn: (lat, lng, level = 3) => {
      webViewRef.current?.injectJavaScript(`focusOn(${lat},${lng},${level}); true;`)
    },
  }))

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"/>
<style>*{margin:0;padding:0}#map{width:100%;height:100vh}</style>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoApiKey}&autoload=false"></script>
</head><body><div id="map"></div><script>
var map,markers=[],polylines=[];
kakao.maps.load(function(){
  map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(${START_LAT},${START_LNG}),level:5});
  // Start marker
  new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(${START_LAT},${START_LNG}),
    content:'<div style="background:#6b7280;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">출</div>',map:map});
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
});
function updateMarkers(list){
  markers.forEach(function(m){m.setMap(null)});markers=[];
  list.forEach(function(m){
    var ov=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(m.lat,m.lng),
      content:'<div style="background:'+m.color+';color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">'+m.label+'</div>',map:map});
    markers.push(ov);
  });
}
var segColors=['#3b82f6','#f59e0b','#22c55e','#ef4444','#8b5cf6'];
function drawPolylines(segs){
  polylines.forEach(function(p){p.setMap(null)});polylines=[];
  segs.forEach(function(seg,i){
    if(seg.route_coords.length>=2){
      var path=seg.route_coords.map(function(c){return new kakao.maps.LatLng(c.lat,c.lng)});
      var pl=new kakao.maps.Polyline({path:path,strokeWeight:5,strokeColor:segColors[i%segColors.length],strokeOpacity:0.8,strokeStyle:'solid',map:map});
      polylines.push(pl);
    }
  });
}
function drawSimpleLine(coords){
  polylines.forEach(function(p){p.setMap(null)});polylines=[];
  var path=[new kakao.maps.LatLng(${START_LAT},${START_LNG})].concat(coords.map(function(c){return new kakao.maps.LatLng(c.lat,c.lng)}));
  var pl=new kakao.maps.Polyline({path:path,strokeWeight:4,strokeColor:'#3b82f6',strokeOpacity:0.5,strokeStyle:'dashed',map:map});
  polylines.push(pl);
}
function fitBounds(){
  var bounds=new kakao.maps.LatLngBounds();
  bounds.extend(new kakao.maps.LatLng(${START_LAT},${START_LNG}));
  markers.forEach(function(m){bounds.extend(m.getPosition())});
  map.setBounds(bounds,50,50,50,50);
}
function focusOn(lat,lng,lv){map.setCenter(new kakao.maps.LatLng(lat,lng));map.setLevel(lv||3);}
</script></body></html>`

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={e => {
          try {
            const data = JSON.parse(e.nativeEvent.data)
            if (data.type === 'ready') setMapReady(true)
          } catch {}
        }}
      />
      {segments.length > 0 && (
        <View style={styles.segmentInfo}>
          {segments.map((seg, i) => {
            const dest = i < visits.length ? visits[i].facility.name : `구간${i + 1}`
            return (
              <View key={i} style={styles.segItem}>
                <View style={[styles.segDot, { backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }]} />
                <Text style={styles.segText}>→ {dest}: {formatDistance(seg.distance)} · {formatDuration(seg.duration)}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
})

KakaoMapWebView.displayName = 'KakaoMapWebView'
export default KakaoMapWebView

const styles = StyleSheet.create({
  container: {},
  webview: { width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.gray[100] },
  segmentInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  segItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gray[50], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  segDot: { width: 8, height: 8, borderRadius: 4 },
  segText: { fontSize: 11, color: Colors.gray[500] },
})
