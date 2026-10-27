#ifndef AppVersion
  #error AppVersion deve ser informada pelo script de build.
#endif

#include "../target/release/installer/messages.iss"

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
UninstallDisplayIcon={app}\nexohub-camaleao.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:desktopIcon}"; Flags: unchecked
Name: "languagetool"; Description: "{cm:reviewTask}"; Flags: unchecked

[Files]
Source: "..\target\release\nexohub-desktop.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\apps\desktop\src-tauri\icons\icon.ico"; DestDir: "{app}"; DestName: "nexohub-camaleao.ico"; Flags: ignoreversion
Source: "..\target\release\THIRD_PARTY_LICENSES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\target\release\runtime\README.md"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "..\target\release\runtime\setup\install-languagetool.ps1"; DestDir: "{app}\runtime\setup"; Flags: ignoreversion
Source: "..\target\release\runtime\setup\languagetool-community.json"; DestDir: "{app}\runtime\setup"; Flags: ignoreversion
Source: "..\target\release\runtime\setup\languagetool-jars.json"; DestDir: "{app}\runtime\setup"; Flags: ignoreversion
Source: "..\target\release\runtime\setup\languagetool-java-files.json"; DestDir: "{app}\runtime\setup"; Flags: ignoreversion
Source: "..\target\release\runtime\MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\NexoHub"; Filename: "{app}\nexohub-desktop.exe"; IconFilename: "{app}\nexohub-camaleao.ico"
Name: "{autodesktop}\NexoHub"; Filename: "{app}\nexohub-desktop.exe"; IconFilename: "{app}\nexohub-camaleao.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\nexohub-desktop.exe"; Description: "{cm:launchApp}"; Flags: nowait postinstall skipifsilent; Check: CanLaunch

[Code]
var
  LanguageToolSetupFailed: Boolean;

function CanLaunch: Boolean;
begin
  Result := not LanguageToolSetupFailed;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  Parameters: String;
begin
  if (CurStep <> ssPostInstall) or not WizardIsTaskSelected('languagetool') then Exit;
  WizardForm.StatusLabel.Caption := CustomMessage('reviewPreparing');
  Parameters := ExpandConstant('-NoProfile -ExecutionPolicy Bypass -File "{app}\runtime\setup\install-languagetool.ps1" -InstallRoot "{app}\runtime\languagetool" -ManifestPath "{app}\runtime\setup\languagetool-community.json" -InventoryPath "{app}\runtime\setup\languagetool-jars.json" -JavaInventoryPath "{app}\runtime\setup\languagetool-java-files.json" -LogPath "{app}\runtime\setup\languagetool-install.log"');
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Parameters,
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
  begin
    LanguageToolSetupFailed := True;
    SuppressibleMsgBox(CustomMessage('reviewFailed'), mbError, MB_OK, IDOK);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and LanguageToolSetupFailed then
    WizardForm.FinishedLabel.Caption := CustomMessage('reviewFailed');
end;

function GetCustomSetupExitCode: Integer;
begin
  if LanguageToolSetupFailed then Result := 20 else Result := 0;
end;

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
    Result := CustomMessage('webviewFailed');
end;
