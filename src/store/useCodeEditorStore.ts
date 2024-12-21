import { create } from "zustand";
import { Monaco } from "@monaco-editor/react";

import { CodeEditorState } from "./../types/index";
import { LANGUAGE_CONFIG } from "@/app/(home)/_constants";

const getInitialState = () => {
  // if we are on server, we are goingto return default values
  if (typeof window === "undefined") {
    return {
      language: "javascript",
      fontSize: 16,
      theme: "vs-dark",
    };
  }
  //   when we are on the client, we are going to return values from localStorage as it is a browser API
  const savedLanguage = localStorage.getItem("editor-language") || "javascript";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";

  return {
    language: savedLanguage,
    fontSize: Number(savedFontSize),
    theme: savedTheme,
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
  const initialState = getInitialState();
  return {
    ...initialState,
    output: "",
    isRunning: false,
    error: null,
    editor: null,
    executionResult: null,

    getCode: () => get().editor?.getValue() || "",

    setEditor: (editor: Monaco) => {
      const savedCode = localStorage.getItem(`editor-code-${get().language}`);
      if (savedCode) {
        editor.setValue(savedCode);
      }
      set({ editor });
    },

    setTheme: (theme: string) => {
      localStorage.setItem(`editor-theme`, theme);
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      localStorage.setItem(`editor-fontSize`, fontSize.toString());
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      // save current language code and then switch
      const currentCode = get().editor?.getValue();
      if (currentCode) {
        localStorage.setItem(`editor-code-${get().language}`, currentCode);
      }
      localStorage.setItem("editor-language", language);
      set({ language, output: "", error: null });
    },

    runCode: async () => {
      const { language, getCode } = get();
      const code = getCode();

      if (!code) {
        set({ error: "No Code Found" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        const runtime = LANGUAGE_CONFIG[language].pistonRuntime;
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language: runtime.language,
            version: runtime.version,
            files: [{ content: code }],
          }),
        });
        const data = await response.json();

        // console.log("Data Back from Piston: ", data);

        // handling API Level Errors
        if (data.message) {
          set({
            error: data.message,
            executionResult: { code, output: "", error: data.message },
          });
          return;
        }

        // handling compilation errors for compiled languages
        if (data.compile && data.compile.code !== 0) {
          const error = data.compile.stderr || data.compile.output;
          set({
            error,
            executionResult: {
              code,
              output: "",
              error,
            },
          });
          return;
        }

        // handling runtime errors
        if (data.run && data.run.code !== 0) {
          const error = data.run.stderr || data.run.output;
          set({
            error,
            executionResult: {
              code,
              output: "",
              error,
            },
          });
          return;
        }

        // when execution is successful
        const output = data.run.output;

        set({
          output: output.trim(),
          error: null,
          executionResult: {
            code,
            output: output.trim(),
            error: null,
          },
        });
      } catch (error) {
        // console.log("Error running the code: ", error);
        set({
          error: "Error running the code",
          executionResult: {
            code,
            output: "",
            error: "Error running the code",
          },
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () =>
  useCodeEditorStore.getState().executionResult;
