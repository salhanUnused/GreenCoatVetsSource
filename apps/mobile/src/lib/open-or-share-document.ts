import { Alert, Linking } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

function safeFilename(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "document.pdf";
}

/** Download a PDF to cache and open the native share sheet (save, AirDrop, etc.). */
export async function sharePdfFromUrl(url: string, filename: string) {
  const localPath = `${FileSystem.cacheDirectory}${safeFilename(filename)}`;
  const download = await FileSystem.downloadAsync(url, localPath);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Save or share PDF",
      UTI: "com.adobe.pdf",
    });
    return;
  }
  await Linking.openURL(url);
}

export async function promptOpenOrSharePdf(url: string, title: string) {
  Alert.alert(title, "Choose how to view this document.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Open",
      onPress: () => {
        void Linking.openURL(url);
      },
    },
    {
      text: "Download / Share",
      onPress: () => {
        void sharePdfFromUrl(url, `${title}.pdf`).catch((e) => {
          Alert.alert("Could not share", e instanceof Error ? e.message : "Try again.");
        });
      },
    },
  ]);
}
