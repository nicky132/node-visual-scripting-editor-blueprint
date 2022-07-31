import CommonUtils from "../utils/CommonUtils";

export class SettingsService {
  getSettingsBoolean(key : string, defaultVlaue : boolean) : boolean {
    let s = localStorage.getItem(key);
    if(CommonUtils.isNullOrEmpty(s)) 
      return defaultVlaue;
    return s == 'true';
  }
  setSettingsBoolean(key : string, value : boolean) {
    localStorage.setItem(key, value ? 'true' : 'false');
  }
  setSettings(key : string, value : string) {
    localStorage.setItem(key, value);
  }
  getSettings(key : string, defaultVlaue : string) : string {
    let s = localStorage.getItem(key);
    if(CommonUtils.isNullOrEmpty(s)) 
      return defaultVlaue;
    return s;
  }
  getSettingsNumber(key : string, defaultVlaue : number) : number {
    let s = localStorage.getItem(key);
    if(CommonUtils.isNullOrEmpty(s)) 
      return defaultVlaue;
    return parseFloat(s);
  }
  setSettingsNumber(key : string, value : number) {
    localStorage.setItem(key, value.toString());
  }
}

let SettingsServiceInstance = new SettingsService();

export default SettingsServiceInstance;