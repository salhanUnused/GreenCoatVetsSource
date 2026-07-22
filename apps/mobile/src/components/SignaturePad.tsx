import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../theme/theme";

const HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html,body{margin:0;padding:0;background:#fff;height:100%;overflow:hidden;touch-action:none}
  canvas{display:block;width:100%;height:100%;touch-action:none;border:0}
</style></head><body>
<canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
    ctx.strokeStyle = '#0e3d34';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  window.addEventListener('resize', resize);
  let drawing = false;
  function pos(e){
    const t = e.touches && e.touches[0] ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  function start(e){ e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(e){ if(!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(){ drawing = false; }
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  window.clearPad = function(){ resize(); };
  window.exportPad = function(){
    const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let ink = 0;
    for (let i=0;i<data.length;i+=4){ if(data[i]<250||data[i+1]<250||data[i+2]<250) ink++; }
    const value = ink > 80 ? canvas.toDataURL('image/png') : '';
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', value }));
  };
</script></body></html>`;

type WebViewHandle = {
  injectJavaScript?: (script: string) => void;
};

export function SignaturePad({
  onChange,
  height = 150,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const webRef = useRef<WebViewHandle | null>(null);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const parsed = JSON.parse(event.nativeEvent.data) as { type?: string; value?: string };
        if (parsed.type === "signature") {
          onChange(parsed.value?.startsWith("data:image/png") ? parsed.value : null);
        }
      } catch {
        /* ignore */
      }
    },
    [onChange],
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.pad, { height }]}>
        <WebView
          ref={(node) => {
            webRef.current = node as unknown as WebViewHandle | null;
          }}
          originWhitelist={["*"]}
          source={{ html: HTML }}
          onMessage={onMessage}
          javaScriptEnabled
          style={styles.webview}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            webRef.current?.injectJavaScript?.("window.clearPad && window.clearPad(); true;");
            onChange(null);
          }}
        >
          <Text style={styles.btnText}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => webRef.current?.injectJavaScript?.("window.exportPad && window.exportPad(); true;")}
        >
          <Text style={[styles.btnText, styles.btnPrimaryText]}>Capture signature</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Draw, then tap Capture signature before submitting.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  pad: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: "#fff",
  },
  webview: { flex: 1, backgroundColor: "#fff" },
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: theme.surfaceContainer,
  },
  btnPrimary: { backgroundColor: theme.primary, borderColor: theme.primary },
  btnText: { fontWeight: "700", color: theme.onSurface, fontSize: 13 },
  btnPrimaryText: { color: theme.onPrimary },
  hint: { fontSize: 11, color: theme.onSurfaceVariant, fontWeight: "600" },
});
