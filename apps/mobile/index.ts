import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

registerRootComponent(App);
