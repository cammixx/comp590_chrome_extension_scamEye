const getRiskColor = (riskPercent: number) => {
  if (riskPercent <= 20) return { color: "#28a745", label: "Safe" };
  if (riskPercent <= 40) return { color: "#ffc107", label: "Caution" };
  if (riskPercent <= 60) return { color: "#fd7e14", label: "Risky" };
  if (riskPercent <= 80) return { color: "#dc3545", label: "Dangerous" };
  return { color: "#8b0000", label: "Highly Dangerous" };
};

let activePopup: HTMLDivElement | null = null;
let activeLink: string | null = null;

const updateStats = (riskPercent: number) => {
  const currentLinksScanned = parseInt(
    localStorage.getItem("scameye-links-scanned") || "0"
  );
  localStorage.setItem(
    "scameye-links-scanned",
    (currentLinksScanned + 1).toString()
  );

  if (riskPercent > 60) {
    const currentThreatLinks = parseInt(
      localStorage.getItem("scameye-threat-links") || "0"
    );
    localStorage.setItem(
      "scameye-threat-links",
      (currentThreatLinks + 1).toString()
    );
  }

  window.dispatchEvent(new CustomEvent("scameye-stats-updated"));
};

const getRiskPercentFromApi = async (
  url: string
): Promise<{ riskPercent: number; resolvedUrl: string }> => {
  try {
    const response = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return { riskPercent: 50, resolvedUrl: url };
    }

    const data = await response.json();
    return {
      riskPercent: data.risk ?? 50,
      resolvedUrl: data.url ?? url,
    };
  } catch (error) {
    console.log(error);
    return { riskPercent: 50, resolvedUrl: url };
  }
};

document.addEventListener("mouseover", async (event: MouseEvent) => {
  chrome.storage.local.get(
    ["extensionEnabled", "showOnlyRiskyOnes"],
    async (data) => {
      if (!data.extensionEnabled) return;

      const target = event.target as HTMLAnchorElement;

      if (target.tagName === "A" && target.href) {
        if (activeLink === target.href) return;

        if (activePopup) {
          activePopup.remove();
          activePopup = null;
        }

        const { riskPercent, resolvedUrl } = await getRiskPercentFromApi(
          target.href
        );

        // Check if "Show Only Risky Ones" is enabled and riskPercent <= 60
        if (data.showOnlyRiskyOnes && riskPercent <= 60) {
          return; // Don't show popup if link is not risky enough
        }

        const { color, label } = getRiskColor(riskPercent);

        updateStats(riskPercent);

        const popup = document.createElement("div");
        popup.id = "scameye-popup";
        popup.innerHTML = `
        <div style="
          display: flex; 
          align-items: center; 
          gap: 8px;
          font-family: Arial, sans-serif;
          background: white;
          border-radius: 10px;
          padding: 12px;
          position: fixed;
          top: ${event.clientY + 10}px;
          left: ${event.clientX + 10}px;
          z-index: 9999;
          box-shadow: 0px 4px 10px rgba(0,0,0,0.2);
          border-left: 5px solid ${color};
          max-width: 280px;
          word-wrap: break-word;
          overflow-wrap: break-word;
        ">
          <img src="${chrome.runtime.getURL(
            "logo.png"
          )}" alt="ScamEye Logo" style="width: 24px; height: 24px;">
          <div style="max-width: 100%;">
            <p style="margin: 0; font-size: 14px; color: #262626; font-weight: bold; white-space: normal;">
              Checking risk for:
            </p>
            <div style="margin: 0; font-size: 12px; color: #555; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
              <div><strong>Original:</strong> ${target.href}</div>
              <div><strong>Resolved:</strong> ${resolvedUrl}</div>
            </div>
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: ${color}; white-space: normal;">
              ${label} (${riskPercent}%)
            </p>
          </div>
        </div>
      `;

        document.body.appendChild(popup);
        activePopup = popup;
        activeLink = target.href;

        const handleMouseLeave = () => {
          if (activePopup) {
            activePopup.remove();
            activePopup = null;
            activeLink = null;
          }
          target.removeEventListener("mouseleave", handleMouseLeave);
        };

        target.addEventListener("mouseleave", handleMouseLeave);
      }
    }
  );
});

document.addEventListener("mouseout", (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName !== "A") {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (
      !relatedTarget ||
      (relatedTarget.tagName !== "A" && !target.contains(relatedTarget))
    ) {
      if (activePopup) {
        activePopup.remove();
        activePopup = null;
        activeLink = null;
      }
    }
  }
});
