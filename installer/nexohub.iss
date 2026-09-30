#ifndef AppVersion
  #error AppVersion deve ser informada pelo script de build.
#endif

[Setup]
AppId={{C7B2C938-B30A-4514-B491-92CC0358DB1A}
AppName=NexoHub
AppVersion={#AppVersion}
AppPublisher=NexoHub
DefaultDirName={localappdata}\Programs\NexoHub
DefaultGroupName=NexoHub
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\target\release\installer
OutputBaseFilename=NexoHub_{#AppVersion}_x64-setup
SetupIconFile=..\apps\desktop\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\nexohub-desktop.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; Flags: unchecked

[Files]
Source: "..\target\release\nexohub-desktop.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\target\release\THIRD_PARTY_LICENSES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\target\release\runtime\*"; DestDir: "{app}\runtime"; Excludes: "MicrosoftEdgeWebview2Setup.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\target\release\runtime\MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\NexoHub"; Filename: "{app}\nexohub-desktop.exe"
Name: "{autodesktop}\NexoHub"; Filename: "{app}\nexohub-desktop.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\nexohub-desktop.exe"; Description: "Abrir NexoHub"; Flags: nowait postinstall skipifsilent

[Code]
function WebView2Installed: Boolean;
var
  Version: string;
  Key: string;
begin
  Key := 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := RegQueryStringValue(HKCU, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
  if not Result then
    Result := RegQueryStringValue(HKLM32, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
begin
  Result := '';
  if WebView2Installed then Exit;
  ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
  if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '', SW_HIDE,
    ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) or not WebView2Installed then
    Result := 'Não foi possível instalar o Microsoft Edge WebView2 Runtime, necessário para abrir o NexoHub.';
end;
