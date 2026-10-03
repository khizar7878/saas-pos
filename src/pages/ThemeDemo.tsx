import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const themeOptions = [
  {
    id: "cool-slate",
    name: "Cool Slate",
    description: "Blue-tinted grey (like VS Code) - modern & techy",
    primary: "hsl(215, 15%, 65%)",
    background: "hsl(220, 20%, 10%)",
    card: "hsl(220, 18%, 13%)",
    accent: "hsl(215, 12%, 20%)",
  },
  {
    id: "neutral-stone",
    name: "Neutral Stone",
    description: "Pure balanced grey - clean & minimal",
    primary: "hsl(0, 0%, 70%)",
    background: "hsl(0, 0%, 9%)",
    card: "hsl(0, 0%, 12%)",
    accent: "hsl(0, 0%, 18%)",
  },
  {
    id: "warm-zinc",
    name: "Warm Zinc",
    description: "Slightly warm grey - softer on the eyes",
    primary: "hsl(30, 5%, 68%)",
    background: "hsl(20, 10%, 9%)",
    card: "hsl(20, 8%, 12%)",
    accent: "hsl(20, 6%, 18%)",
  },
  {
    id: "deep-charcoal",
    name: "Deep Charcoal",
    description: "Rich dark grey - dramatic & elegant",
    primary: "hsl(240, 5%, 70%)",
    background: "hsl(240, 10%, 6%)",
    card: "hsl(240, 8%, 10%)",
    accent: "hsl(240, 6%, 16%)",
  },
];

const ThemeDemo = () => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Dark Mode Theme Options</h1>
          <p className="text-neutral-400">Click on a theme to see how it looks</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {themeOptions.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelected(theme.id)}
              className="text-left transition-transform hover:scale-[1.02] focus:outline-none"
            >
              <div
                className="rounded-2xl p-6 border-2 transition-colors"
                style={{
                  backgroundColor: theme.background,
                  borderColor: selected === theme.id ? theme.primary : "transparent",
                }}
              >
                {/* Theme Name & Selection */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{theme.name}</h3>
                    <p className="text-sm" style={{ color: "hsl(0, 0%, 55%)" }}>
                      {theme.description}
                    </p>
                  </div>
                  {selected === theme.id && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: theme.primary }}
                    >
                      <Check className="w-5 h-5 text-black" />
                    </div>
                  )}
                </div>

                {/* Mini Dashboard Preview */}
                <div
                  className="rounded-xl p-4 space-y-4"
                  style={{ backgroundColor: theme.card }}
                >
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg p-3"
                        style={{ backgroundColor: theme.accent }}
                      >
                        <div
                          className="text-xs mb-1"
                          style={{ color: "hsl(0, 0%, 50%)" }}
                        >
                          Stat {i}
                        </div>
                        <div className="text-lg font-semibold text-white">1,234</div>
                      </div>
                    ))}
                  </div>

                  {/* Button preview */}
                  <div className="flex gap-3">
                    <div
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.background,
                      }}
                    >
                      Primary Button
                    </div>
                    <div
                      className="px-4 py-2 rounded-lg text-sm font-medium border"
                      style={{
                        borderColor: theme.accent,
                        color: "hsl(0, 0%, 80%)",
                      }}
                    >
                      Secondary
                    </div>
                  </div>

                  {/* Color swatches */}
                  <div className="flex gap-2 pt-2">
                    <div className="flex-1 text-center">
                      <div
                        className="h-8 rounded-md mb-1"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <span className="text-xs" style={{ color: "hsl(0, 0%, 50%)" }}>
                        Primary
                      </span>
                    </div>
                    <div className="flex-1 text-center">
                      <div
                        className="h-8 rounded-md mb-1"
                        style={{ backgroundColor: theme.background }}
                      />
                      <span className="text-xs" style={{ color: "hsl(0, 0%, 50%)" }}>
                        Background
                      </span>
                    </div>
                    <div className="flex-1 text-center">
                      <div
                        className="h-8 rounded-md mb-1"
                        style={{ backgroundColor: theme.card }}
                      />
                      <span className="text-xs" style={{ color: "hsl(0, 0%, 50%)" }}>
                        Card
                      </span>
                    </div>
                    <div className="flex-1 text-center">
                      <div
                        className="h-8 rounded-md mb-1"
                        style={{ backgroundColor: theme.accent }}
                      />
                      <span className="text-xs" style={{ color: "hsl(0, 0%, 50%)" }}>
                        Accent
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="text-center">
            <p className="text-neutral-400 mb-4">
              Selected: <span className="text-white font-medium">{themeOptions.find(t => t.id === selected)?.name}</span>
            </p>
            <p className="text-neutral-500 text-sm">
              Tell me which one you like and I'll apply it to your app!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeDemo;
