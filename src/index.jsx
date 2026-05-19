const activeFile = dc.resolvePath("GAME ENGINE BUILD") || "_RESOURCES/DATACORE/_DONE/GAME ENGINE BUILD/GAME ENGINE BUILD";
const outerFolderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));

function View(props) {
  const base = props.folderPath || outerFolderPath;
  const [MainApp, setMainApp] = dc.useState(null);

  dc.useEffect(() => {
    dc.require(base + "/src/App.jsx").then(({ View: LoadedView }) => {
      setMainApp(() => LoadedView);
    }).catch(err => {
      console.error("Failed to load Game Engine App:", err);
    });
  }, [base]);

  if (!MainApp) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9d7cce', fontFamily: 'monospace' }}>
        <dc.Icon icon="loader-2" style={{ animation: "spin 1s linear infinite", marginRight: "8px" }} />
        Loading bootstrapper...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <MainApp {...props} folderPath={base} />;
}

return { View };
