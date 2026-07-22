import { useCallback, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../theme/theme";

/** Inline pad that posts draw lock + PNG to React Native (touch-action none so parents don't scroll). */
const HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff;touch-action:none;overscroll-behavior:none}
  canvas{display:block;width:100%;height:100%;touch-action:none;overscroll-behavior:none}
</style></head><body>
<canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let dirty = false;

  function post(msg){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }

  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#0e3d34';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    dirty = false;
  }
  resize();
  window.addEventListener('resize', resize);

  function pos(e){
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function exportPng(){
    if (!dirty) {
      post({ type: 'signature', value: '' });
      return;
    }
    post({ type: 'signature', value: canvas.toDataURL('image/png') });
  }

  function start(e){
    e.preventDefault();
    e.stopPropagation();
    drawing = true;
    post({ type: 'draw', active: true });
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e){
    if (!drawing) return;
    e.preventDefault();
    e.stopPropagation();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty = true;
  }
  function end(e){
    if (!drawing) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    drawing = false;
    post({ type: 'draw', active: false });
    exportPng();
  }

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
  canvas.addEventListener('touchcancel', end, { passive: false });
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  document.body.addEventListener('touchmove', function(e){ e.preventDefault(); }, { passive: false });

  window.clearPad = function(){ resize(); post({ type: 'signature', value: '' }); };
  window.exportPad = exportPng;
</script></body></html>`;

type WebViewHandle = {
  injectJavaScript?: (script: string) => void;
};

export function SignaturePad({
  onChange,
  onDrawActiveChange,
  height = 200,
}: {
  onChange: (dataUrl: string | null) => void;
  /** Parent should disable ScrollView while this is true. */
  onDrawActiveChange?: (active: boolean) => void;
  height?: number;
}) {
  const webRef = useRef<WebViewHandle | null>(null);
  const lockRef = useRef(false);

  const setLock = useCallback(
    (active: boolean) => {
      if (lockRef.current === active) return;
      lockRef.current = active;
      onDrawActiveChange?.(active);
    },
    [onDrawActiveChange],
  );

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const parsed = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          value?: string;
          active?: boolean;
        };
        if (parsed.type === "draw") {
          setLock(Boolean(parsed.active));
          return;
        }
        if (parsed.type === "signature") {
          onChange(parsed.value?.startsWith("data:image/png") ? parsed.value : null);
        }
      } catch {
        /* ignore */
      }
    },
    [onChange, setLock],
  );

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.pad, { height }]}
        onTouchStart={() => setLock(true)}
        onTouchEnd={() => setLock(false)}
        onTouchCancel={() => setLock(false)}
        // Claim the gesture so the parent ScrollView does not scroll while signing.
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
      >
        <WebView
          ref={(node) => {
            webRef.current = node as unknown as WebViewHandle | null;
          }}
          originWhitelist={["*"]}
          source={{ html: HTML }}
          onMessage={onMessage}
          javaScriptEnabled
          style={styles.webview}
          {...({
            nestedScrollEnabled: false,
            overScrollMode: "never",
            setSupportMultipleWindows: false,
            androidLayerType: Platform.OS === "android" ? "hardware" : undefined,
          } as object)}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            setLock(false);
            webRef.current?.injectJavaScript?.("window.clearPad && window.clearPad(); true;");
            onChange(null);
          }}
        >
          <Text style={styles.btnText}>Clear</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Sign in the box above — scrolling is locked while you draw.</Text>
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
  webview: { flex: 1, backgroundColor: "#fff", opacity: 0.99 },
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
  btnText: { fontWeight: "700", color: theme.onSurface, fontSize: 13 },
  hint: { fontSize: 11, color: theme.onSurfaceVariant, fontWeight: "600" },
});
