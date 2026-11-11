import { useAppMotion } from '@/providers/motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { USE_NATIVE_DRIVER } from "@/lib/app-environment";

type ToastState = {
  message: string;
  success: boolean;
  key: number;
};

type ToastContextValue = {
  showToast: (message: string, success?: boolean) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { animationsEnabled } = useAppMotion();
  const motion = useRef(animationsEnabled);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translate] = useState(() => new Animated.Value(12));
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    motion.current = animationsEnabled;
    if (!animationsEnabled) {
      opacity.stopAnimation();
      translate.stopAnimation();
      opacity.setValue(1);
      translate.setValue(0);
    }
  }, [animationsEnabled, opacity, translate]);

  const showToast = useCallback(
    (message: string, success = true) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, success, key: Date.now() });
      opacity.stopAnimation();
      translate.stopAnimation();
      opacity.setValue(motion.current ? 0 : 1);
      translate.setValue(motion.current ? 12 : 0);
      if (motion.current) Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translate, {
          toValue: 0,
          duration: 180,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
      timer.current = setTimeout(() => {
        if (!motion.current) { setToast(null); return; }
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(({ finished }) => { if (finished) setToast(null); });
      }, 3000);
    },
    [opacity, translate],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 84,
            opacity,
            transform: [{ translateY: translate }],
            zIndex: 1000,
          }}
        >
          <View
            style={{
              backgroundColor: toast.success ? "#21894A" : "#C43D3D",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 9,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={toast.success ? "checkmark-circle" : "alert-circle"}
              size={20}
              color="#fff"
            />
            <Text
              numberOfLines={2}
              style={{
                color: "#fff",
                fontSize: 14,
                lineHeight: 17,
                marginLeft: 9,
                flex: 1,
              }}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("ToastProvider is missing.");
  return value;
}
