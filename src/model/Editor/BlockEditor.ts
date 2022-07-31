import { Vector2 } from "../Vector2"
import { Rect } from "../Rect";
import { BlockRegData, BlockParameterTypeRegData, BlockParameterEnumRegData, BlockParameterEditorRegData, BlockEditorComponentCreateFn, BlockParametersChangeSettings, BlockStyleSettings, BlockPortEditorComponentCreateFn, BlockMenuSettings, BlockPortRegData, BlockMouseEventFn, PortAnyFlexableData, BlockPortAnyFlexablesData } from "../Define/BlockDef";
import { BlockPort, BlockPortDirection } from "../Define/Port";

import CommonUtils from "../../utils/CommonUtils";
import AllEditors from "../TypeEditors/AllEditors";
import ParamTypeServiceInstance from "../../sevices/ParamTypeService";
import { Block, OnBlockEditorEventCallback, OnUserAddPortCallback } from "../Define/Block";
import { ConnectorEditor } from "../Editor/ConnectorEditor";
import { BlockEditorOwner } from "./BlockEditorOwner";
import StringUtils from "../../utils/StringUtils";
import HtmlUtils from "../../utils/HtmlUtils";
import ToolTipUtils from "../../utils/ToolTipUtils";
import BlockUtils from "../Blocks/Utils/BlockUtils";
import { BlockPortEditor, BlockPortIcons } from "./BlockPortEditor";
import { MouseEventDelegate } from "@/utils/EventHandler";


export const SIZE_LEFT = 0x1;
export const SIZE_RIGHT = 0x2;
export const SIZE_TOP = 0x4;
export const SIZE_BOTTOM = 0x8;

/**
 * 编辑器模式下的单元。
 * 扩展了单元的编辑事件操作与管理,供编辑器使用。
 * 运行时中不会声明此类。
 */
export class BlockEditor extends Block {

  public position : Vector2 = new Vector2();
  public size : Vector2 = new Vector2(150, 200);

  public name = '';
  public description = '';
  /**
   * 块的用户注释
   */
  public mark = '';
  public markOpen = false;

  public logo = '';

  public selected = false;
  public hover = false;

  private rect = new Rect();
  
  public editor : BlockEditorOwner = null;

  public constructor(regData ?: BlockRegData) {
    super(regData, true);
   
    this.onAddPortElement.addListener(this, (block, port) => this.addPortElement(port));
    this.onRemovePortElement.addListener(this, (block, port) => this.removePortElement(port));
    this.onUpdatePortElement.addListener(this, (block, port) => this.updatePortElement(port));
    this.onPortValueUpdate.addListener(this, (block, port) => this.updatePortParamDisplayVal(port));
    this.onPortConnectorActive.addListener(this, (port, connector) => {
      if(this.currentRunner && this.currentRunner.state != 'stopped') 
        (<ConnectorEditor>connector).active(port);
    });
    this.onPortRemove.addListener(this, this.onPortRemoveCallback);
    this.onEnterBlock.addListener(this, () => this.markActive());
    this.onLeaveBlock.addListener(this, () => this.markDective());
  }

  public blockStyleSettings = new BlockStyleSettings();
  public blockMenuSettings = new BlockMenuSettings();

  public getRect() { 
    this.rect.setPos(this.position);
    this.rect.setSize(this.size);
    return this.rect; 
  }

  public el : HTMLDivElement = null;
  public els = new BlockEditorHTMLData();

  public created = false;
  public forceNotUnConnect = false;

  public create(editor : BlockEditorOwner) {

    this.isEditorBlock = true;
    this.editor = editor;
    this.created = true;

    if(this.regData) {
      this.name = this.regData.baseInfo.name;
      this.description = this.regData.baseInfo.description;
      this.logo = this.regData.baseInfo.logo;
      this.blockStyleSettings = this.regData.blockStyle;
      this.blockMenuSettings = this.regData.blockMenu;
      this.portAnyFlexables = this.regData.portAnyFlexables;

      this.onCreateCustomEditor = this.regData.callbacks.onCreateCustomEditor;
      this.onUserAddPort = this.regData.callbacks.onUserAddPort;
      this.onCreatePortCustomEditor = this.regData.callbacks.onCreatePortCustomEditor;
      this.onSave = this.regData.callbacks.onSave;
      this.onMouseEvent = this.regData.callbacks.onBlockMouseEvent;

      this.portsChangeSettings = this.regData.settings.portsChangeSettings;
      this.parametersChangeSettings = this.regData.settings.parametersChangeSettings;
    }

    let host = this.editor.getBlockHostElement(this.blockStyleSettings.layer);

    this.el = document.createElement('div');
    this.el.classList.add("flow-block");
    this.el.setAttribute("id", this.uid);

    if(!StringUtils.isNullOrEmpty(this.blockStyleSettings.minWidth))
      this.el.style.minWidth = this.blockStyleSettings.minWidth;
    if(!StringUtils.isNullOrEmpty(this.blockStyleSettings.minHeight))
      this.el.style.minHeight = this.blockStyleSettings.minHeight;

    this.els.elSizeDragger = document.createElement('div');
    this.els.elSizeDragger.classList.add('size-dragger');
    if(!this.userCanResize) HtmlUtils.hideElement(this.els.elSizeDragger);

    //#region Ports

    let content = document.createElement('div');
    let areaPorts = document.createElement('div');
    let areaPortsBottom = document.createElement('div');

    this.els.elInputPorts = document.createElement('div');
    this.els.elInputPorts.classList.add("ports", 'input');
    this.els.elOutputPorts = document.createElement('div');
    this.els.elOutputPorts.classList.add("ports", 'output');

    this.els.elAddInputBehaviorPort = document.createElement('a');
    this.els.elAddOutputBehaviorPort = document.createElement('a');
    this.els.elAddInputBehaviorPort.classList.add('port-add','iconfont', 'Behavior', BlockPortIcons.portBehaviorAddIcon);
    this.els.elAddOutputBehaviorPort.classList.add('port-add','iconfont', 'Behavior',BlockPortIcons.portBehaviorAddIcon);
    this.els.elAddInputBehaviorPort.setAttribute('data-title', '添加入端口');
    this.els.elAddOutputBehaviorPort.setAttribute('data-title', '添加出端口');
    ToolTipUtils.registerElementTooltip(this.els.elAddInputBehaviorPort);
    ToolTipUtils.registerElementTooltip(this.els.elAddOutputBehaviorPort);
    this.els.elAddInputBehaviorPort.onclick = this.onUserAddInputPort.bind(this);
    this.els.elAddOutputBehaviorPort.onclick = this.onUserAddOutputPort.bind(this);

    this.els.elAddInputParamPort = document.createElement('a');
    this.els.elAddOutputParamPort = document.createElement('a');

    this.els.elAddInputParamPort.classList.add('port-add','iconfont', 'Param', BlockPortIcons.portParamAddIcon);
    this.els.elAddOutputParamPort.classList.add('port-add','iconfont', 'Param', BlockPortIcons.portParamAddIcon);
    this.els.elAddInputParamPort.setAttribute('data-title', '添加入参数');
    this.els.elAddOutputParamPort.setAttribute('data-title', '添加出参数');
    ToolTipUtils.registerElementTooltip(this.els.elAddInputParamPort);
    ToolTipUtils.registerElementTooltip(this.els.elAddOutputParamPort);
    this.els.elAddInputParamPort.onclick = this.onUserAddInputParam.bind(this);
    this.els.elAddOutputParamPort.onclick = this.onUserAddOutputParam.bind(this);

    areaPorts.classList.add("area");
    areaPorts.appendChild(this.els.elInputPorts);
    areaPorts.appendChild(this.els.elOutputPorts);
    areaPortsBottom.classList.add("area-bottom");
    areaPortsBottom.appendChild(this.els.elAddInputBehaviorPort);
    areaPortsBottom.appendChild(this.els.elAddInputParamPort);
    areaPortsBottom.appendChild(this.els.elAddOutputParamPort);
    areaPortsBottom.appendChild(this.els.elAddOutputBehaviorPort);

    content.appendChild(areaPorts);
    content.appendChild(areaPortsBottom);
    content.classList.add("content");

    //#endregion

    //#region Title and logo

    this.els.elTitle = document.createElement('div');
    this.els.elTitle.classList.add("title");
    this.els.elTitle.setAttribute('data-title', this.description);

    if(!this.blockStyleSettings.noTooltip)
      ToolTipUtils.registerElementTooltip(this.els.elTitle);

    this.els.elBackground = document.createElement('div');
    this.els.elBackground.classList.add("background");


    if(!CommonUtils.isNullOrEmpty(this.blockStyleSettings.titleColor))
      this.els.elTitle.style.color = this.blockStyleSettings.titleColor;
    if(!CommonUtils.isNullOrEmpty(this.blockStyleSettings.titleBakgroundColor))
      this.els.elTitle.style.background = this.blockStyleSettings.titleBakgroundColor;
    if(this.blockStyleSettings.smallTitle) 
      this.els.elTitle.classList.add("small");
    if(this.blockStyleSettings.noTitle) 
      this.els.elTitle.classList.add("hide");

    this.els.elBreakPointArrow = document.createElement('div');
    this.els.elBreakPointArrow.classList.add('breakpoint-arrow','iconfont', 'icon-zuo');
    this.els.elBreakPointArrow.style.display = 'none';

    this.els.elBreakPointStatus = document.createElement('div');
    this.els.elBreakPointStatus.classList.add('breakpoint-status','iconfont');
    this.els.elBreakPointStatus.style.display = 'none';

    this.els.elCustomEditor = document.createElement('div');
    this.els.elCustomEditor.classList.add("custom-editor");

    if(this.blockStyleSettings.smallTitle || this.blockStyleSettings.noTitle) 
      this.els.elCustomEditor.classList.add('without-title');
    
    if(this.blockStyleSettings.smallTitle && !this.blockStyleSettings.noTitle) {

      let titleSmall = document.createElement('div');
      let titleSmallSpan = document.createElement('span');

      titleSmall.classList.add('title-small');
      titleSmallSpan.innerText = this.name
      titleSmall.setAttribute('data-title', this.description);
      titleSmall.appendChild(titleSmallSpan);
      if(!this.blockStyleSettings.noTooltip)
        ToolTipUtils.registerElementTooltip(titleSmall);
      this.el.appendChild(titleSmall);
    }
  
    this.els.elTitleText = document.createElement('span');
    this.els.elLogo = document.createElement('div');
    this.els.elLogo.classList.add("logo");
    this.els.elLogoRight = document.createElement('div');
    this.els.elLogoRight.classList.add("logo-right");
    this.els.elLogoBottom = document.createElement('div');
    this.els.elLogoBottom.classList.add("logo-bottom");

    this.els.elLogo.style.display = (CommonUtils.isNullOrEmpty(this.logo) || this.blockStyleSettings.hideLogo) ? 'none' : 'inline-block';
    if(this.logo.startsWith('<')) this.els.elLogo.innerHTML = this.logo;
    else if(!CommonUtils.isNullOrEmpty(this.logo)) this.els.elLogo.style.backgroundImage = 'url(' + this.logo + ')';

    this.els.elLogoBottom.style.display = CommonUtils.isNullOrEmpty(this.blockStyleSettings.logoBottom) ? 'none' : 'inline-block';
    if(this.logo.startsWith('<')) this.els.elLogoBottom.innerHTML = this.blockStyleSettings.logoBottom;
    else if(!CommonUtils.isNullOrEmpty(this.els.elLogoBottom)) this.els.elLogoBottom.style.backgroundImage = 'url(' + this.blockStyleSettings.logoBottom + ')';
    
    this.els.elLogoRight.style.display = CommonUtils.isNullOrEmpty(this.blockStyleSettings.logoRight) ? 'none' : 'inline-block';
    if(this.logo.startsWith('<')) this.els.elLogoRight.innerHTML = this.blockStyleSettings.logoRight;
    else if(!CommonUtils.isNullOrEmpty(this.els.elLogoRight)) this.els.elLogoRight.style.backgroundImage = 'url(' + this.blockStyleSettings.logoRight + ')';

    if(!CommonUtils.isNullOrEmpty(this.blockStyleSettings.logoBackground)) {
      if(this.blockStyleSettings.logoBackground.startsWith('title:')) this.els.elBackground.innerHTML = '<span class="big-title">' + this.blockStyleSettings.logoBackground.substr(6) + "</span>";
      else if(this.blockStyleSettings.logoBackground.startsWith('<')) this.els.elBackground.innerHTML = this.blockStyleSettings.logoBackground;
      else this.els.elBackground.style.backgroundImage = 'url(' + this.blockStyleSettings.logoBackground + ')';
    }
      
    this.el.appendChild(this.els.elBackground);
    this.els.elTitle.appendChild(this.els.elLogo);
    this.els.elTitle.appendChild(this.els.elTitleText);
    this.els.elTitle.appendChild(this.els.elLogoRight);
    this.els.elTitle.appendChild(this.els.elLogoBottom);

    //#endregion

    //#region Comment

    if(!this.blockStyleSettings.noComment) {

      this.els.elBottomInfoHost = document.createElement('div');
      this.els.elBottomInfoHost.classList.add('bottom-info');
      this.els.elBottomInfoHost.style.display = 'none';

      content.appendChild(this.els.elBottomInfoHost);
  
      this.els.elComment = document.createElement('div');
      this.els.elComment.classList.add('flow-block-comment', 'flow-block-no-move');
      this.els.elCommentText = document.createElement('div');
      this.els.elCommentText.classList.add('flow-block-comment-text', 'flow-block-no-move');
      this.els.elCommentText.setAttribute('contenteditable', 'true');
      this.els.elCommentPlaceHolder = document.createElement('span');
      this.els.elCommentPlaceHolder.classList.add('flow-block-comment-place-holder');
      this.els.elCommentPlaceHolder.innerText = '点击添加注释';
      this.els.elCommentOpen = document.createElement('a');
      this.els.elCommentOpen.setAttribute('data-title', '打开注释气泡');
      this.els.elCommentOpen.classList.add('flow-block-comment-open','iconfont','icon-qipao');
      ToolTipUtils.registerElementTooltip(this.els.elCommentOpen);
      this.els.elCommentClose = document.createElement('a');
      this.els.elCommentClose.classList.add('iconfont','icon-close-');
      this.els.elCommentClose.setAttribute('data-title', '隐藏注释气泡');
      ToolTipUtils.registerElementTooltip(this.els.elCommentClose);

      this.els.elCommentOpen.onclick = () => {
        this.markOpen = true;
        this.updateComment();
      };
      this.els.elCommentClose.onclick = () => {
        this.markOpen = false;
        this.updateComment();
      };
      this.els.elCommentPlaceHolder.onclick = () => {
        this.els.elCommentPlaceHolder.style.display = 'none';
        this.els.elCommentText.focus();
      };
      this.els.elCommentText.oninput = () => {
        this.els.elComment.style.top = -(this.els.elCommentText.offsetHeight - 23 + 40) + 'px';
      };
      this.els.elCommentText.onblur = () => {
        this.mark = this.els.elCommentText.innerText;
        this.updateComment();
      };

      this.els.elComment.appendChild(this.els.elCommentPlaceHolder);
      this.els.elComment.appendChild(this.els.elCommentText);
      this.els.elComment.appendChild(this.els.elCommentClose); 
      this.el.appendChild(this.els.elCommentOpen);
      this.el.appendChild(this.els.elComment);
    }

    //#endregion

    this.el.appendChild(this.els.elTitle);
    this.el.appendChild(this.els.elCustomEditor);
    this.el.appendChild(content);
    this.el.appendChild(this.els.elBreakPointStatus);
    this.el.appendChild(this.els.elBreakPointArrow);
    this.el.appendChild(this.els.elSizeDragger);

    //size
    if(this.userCanResize) {
      if(this.size.x > 0)
        this.el.style.width = this.size.x + 'px';
      if(this.size.y > 0)
        this.el.style.height = this.size.y + 'px';
    }

    //Events

    this.el.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.el.addEventListener('mouseleave', this.onMouseOut.bind(this));
    this.el.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.el.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.el.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.el.addEventListener('resize', this.onResize.bind(this));
    this.el.addEventListener('wheel', this.onMouseWhell.bind(this));
    this.el.addEventListener('contextmenu', this.onContextMenu.bind(this));

    if(!this.blockStyleSettings.noTooltip)
      ToolTipUtils.registerElementTooltip(this.el);

    //load port elements
    this.allPorts.forEach(port => {
      if((<BlockPortEditor>port).editorData == null)
        this.addPortElement(port);
    });

    host.appendChild(this.el);

    this.fnonMouseUp = this.onMouseUp.bind(this);
    this.fnonMouseMove = this.onMouseMove.bind(this);

    this.onEditorCreate.invoke(this);

    if(typeof this.onCreateCustomEditor == 'function')
      this.onCreateCustomEditor(this.els.elCustomEditor, this, this.regData);

    this.onResize();
    this.flushAllPortElementCreateState();
    this.updateContent();
    this.updateBreakPointStatus();
    this.updateComment();

    //运行平台如果不符则抛出错误
    if(!this.isPlatformSupport)
      this.throwError('单元不支持当前平台，因此无法在编辑器中调试该单元。', null, 'warning');
  }
  public destroy() {

    this.onDestroy.invoke(this);
    this.editor.onBlockDelete(this);

    this.created = false;

    this.el.removeEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.el.removeEventListener('mouseleave', this.onMouseOut.bind(this));
    this.el.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.el.removeEventListener('resize', this.onResize.bind(this));
    this.el.removeEventListener('wheel', this.onMouseWhell.bind(this));
    this.el.removeEventListener('contextmenu', this.onContextMenu.bind(this));

    this.inputPorts = null;
    this.outputPorts = null;
    this.allPorts = null;

    this.el.parentNode.removeChild(this.el);
  }
  public clone() {

    //保存自定义数据
    if(typeof this.onSave === 'function')
      this.onSave(this);

    let blockEditor = new BlockEditor(this.regData);
    blockEditor.options = this.options;
    blockEditor.breakpoint = this.breakpoint;
    blockEditor.markOpen = this.markOpen;
    blockEditor.mark = this.mark;

    this.allPorts.forEach(port => {
      if(port.isDyamicAdd)
        blockEditor.addPort(port.regData, true, port.getUserSetValue());
    });

    return blockEditor;
  }

  /**
   * 更新位置
   * @param pos 位置
   */
  public setPos(pos ?: Vector2) {
    if(typeof pos != 'undefined')
      this.position.Set(pos);
    this.el.style.left = this.position.x + 'px';
    this.el.style.top = this.position.y + 'px';
  }
  public setSize(size ?: Vector2) {
    if(typeof this.size != 'undefined')
      this.size.Set(size);
    this.el.style.width = this.size.x + 'px';
    this.el.style.height = this.size.y + 'px';
  }
  /**
   * 断开端口的所有连接
   * @param oldData 目标
   */
  public unConnectPort(oldData : BlockPort) {
    if(oldData.direction == 'input') {
      if(oldData.connectedFromPort.length > 0)
        oldData.connectedFromPort.forEach((c) => 
          this.editor.unConnectConnector(<ConnectorEditor>c.connector));
    }
    else if(oldData.direction == 'output') {
      if(oldData.connectedToPort.length > 0)
        oldData.connectedToPort.forEach((c) => 
          this.editor.unConnectConnector(<ConnectorEditor>c.connector));
    }
  }
  /**
   * 隐藏
   */
  public hide() {
    if(this.created) this.el.style.display = 'none';
  }
  /**
   * 显示
   */
  public show() {
    if(this.created) this.el.style.display = '';
  }

  //#region 数据更新

  public updateZoom(zoom : number) {
    this.el.style.zoom = zoom.toString();
  }
  public updateContent() {
    if(!this.created) return;

    if(this.blockStyleSettings.smallTitle || this.blockStyleSettings.noTitle)
      this.el.setAttribute('data-title', this.name + '\n' + this.description);
    else{
      this.els.elTitleText.innerText = this.name;
      this.els.elTitle.setAttribute('data-title', this.description);
    }
    this.el.setAttribute('data-guid', this.guid);

    this.els.elTitle.style.color = this.blockStyleSettings.titleColor;
    this.els.elTitle.style.background = this.blockStyleSettings.titleBakgroundColor;

    if((!this.portsChangeSettings.userCanAddInputPort && !this.portsChangeSettings.userCanAddOutputPort
      && !this.parametersChangeSettings.userCanAddInputParameter && !this.parametersChangeSettings.userCanAddOutputParameter)) {
      this.els.elAddInputBehaviorPort.style.display = 'none';
      this.els.elAddOutputBehaviorPort.style.display = 'none';
      this.els.elAddInputParamPort.style.display = 'none';
      this.els.elAddOutputParamPort.style.display = 'none';
    } else {
      this.els.elAddInputBehaviorPort.style.display = '';
      this.els.elAddOutputBehaviorPort.style.display = '';
      this.els.elAddInputParamPort.style.display = '';
      this.els.elAddOutputParamPort.style.display = '';
      this.els.elAddInputBehaviorPort.style.visibility = this.portsChangeSettings.userCanAddInputPort ? '' : 'hidden';
      this.els.elAddOutputBehaviorPort.style.visibility = this.portsChangeSettings.userCanAddOutputPort ? '' : 'hidden';
      this.els.elAddInputParamPort.style.visibility = this.parametersChangeSettings.userCanAddInputParameter ? '' : 'hidden';
      this.els.elAddOutputParamPort.style.visibility = this.parametersChangeSettings.userCanAddOutputParameter ? '' : 'hidden';
    }

    if(this.userCanResize) HtmlUtils.showElement(this.els.elSizeDragger);
    else HtmlUtils.hideElement(this.els.elSizeDragger);
    
  }
  public updateSelectStatus(selected?:boolean) {
    if(typeof selected === 'boolean') this.selected = selected;
    if(!this.created) return;

    if(this.selected) this.el.classList.add("selected");
    else this.el.classList.remove("selected");
  }
  public updateBreakPointStatus() {
    if(!this.created) return;
    switch(this.breakpoint) {
      case 'disable':
        this.els.elBreakPointStatus.style.display = 'inline-block';
        this.els.elBreakPointStatus.classList.add('icon-tx-babianxing');
        this.els.elBreakPointStatus.classList.remove('icon-tx-fill-babianxing');
        this.els.elBreakPointStatus.setAttribute('data-title', '此单元已禁用断点');
        break;
      case 'enable':
        this.els.elBreakPointStatus.style.display = 'inline-block';
        this.els.elBreakPointStatus.classList.remove('icon-tx-babianxing');
        this.els.elBreakPointStatus.classList.add('icon-tx-fill-babianxing');
        this.els.elBreakPointStatus.setAttribute('data-title', '此单元已启用断点');
        break;
      case 'none':
        this.els.elBreakPointStatus.style.display = 'none';
        break;
    }
  }
  public updateComment() {
    if(!this.created || this.blockStyleSettings.noComment) 
      return;
    this.els.elComment.style.display = this.markOpen ? '' : 'none';
    this.els.elCommentClose.style.display = this.markOpen ? '' : 'none';
    this.els.elCommentOpen.style.display = this.markOpen ? 'none' : '';
    this.els.elCommentText.innerText = this.mark;
    this.els.elCommentPlaceHolder.style.display = this.mark == '' ? '' : 'none';
  }

  //#endregion

  //#region 节点元素更新
  //===========================

  public portsChangeSettings = {
    userCanAddInputPort: false,
    userCanAddOutputPort: false,
  };

  public parametersChangeSettings : BlockParametersChangeSettings = {
    userCanAddInputParameter: false,
    userCanAddOutputParameter: false,
  };

  private addPortElement(port : BlockPort) { if(this.created) (<BlockPortEditor>port).addPortElement(this); }
  public createOrReCreatePortCustomEditor(port : BlockPort) { (<BlockPortEditor>port).createOrReCreatePortCustomEditor(); }

  public updateAllPortElement() { this.allPorts.forEach((p) => this.updatePortElement(p)); }
  public updateAllParamPort() {
    this.allPorts.forEach((p) => {
      if(!p.paramType.isExecute()) p.updateOnputValue(this.currentRunningContext, undefined);
    });
  }
  public updatePort(port : BlockPort) { this.updatePortElement(port); }
  public updatePortParamDisplayVal(port : BlockPort) { (<BlockPortEditor>port).updatePortParamDisplayVal(); }

  private updatePortElement(port : BlockPort) { if(this.created) (<BlockPortEditor>port).updatePortElement(); }
  private removePortElement(port : BlockPort) { if(this.created) (<BlockPortEditor>port).removePortElement(); }
  private onPortRemoveCallback(block : BlockEditor, port : BlockPort) {
    this.unConnectPort(port);
  }

  public flushAllPortElementCreateState() {
    this.allPorts.forEach((port) => {
      if((<BlockPortEditor>port).editorData == null) {
        this.addPortElement(port);
      }
    })
  }
  public movePortElementUpOrDown(port : BlockPort, move : 'up'|'down') {  
    let portE = (<BlockPortEditor>port);
    let refEl : Element = null;
    let parent = portE.editorData.el.parentNode;
    if(move == 'up') 
      refEl = portE.editorData.el.previousElementSibling;
    else {
      let n = portE.editorData.el.nextElementSibling;
      if(n != null) {
        refEl = n.nextElementSibling;
        if(refEl == null) {
          parent.removeChild(portE.editorData.el);
          parent.appendChild(portE.editorData.el);
        }
      }
    }
    if(refEl != null) {
      parent.removeChild(portE.editorData.el);
      parent.insertBefore(portE.editorData.el, refEl);
    }
  }

  //#endregion

  //#region 编辑器显示状态更新

  public forceUpdateParamValueToEditor(port : BlockPort) {
    let portE = (<BlockPortEditor>port);
    if(portE.editorData.editor != null)
      portE.editorData.editor.forceUpdateValue(port, portE.editorData.elEditor);
  }
  public updatePortConnectStatusElement(port : BlockPort) { (<BlockPortEditor>port).updatePortConnectStatusElement(); }
  public markBreakPointActiveState(active : boolean) {
    if(active) {
      this.el.classList.add('breakpoint-actived');
      this.els.elBreakPointArrow.style.display = '';
    }
    else { 
      this.el.classList.remove('breakpoint-actived');
      this.els.elBreakPointArrow.style.display = 'none';
    }
  }
  public markActive() {
    this.activeFlashCount = 0;
    if(this.activeFlashInterval == null) {
      this.el.classList.add('actived');
      
      this.activeFlashInterval = setInterval(() => {
        this.el.classList.toggle('actived');
        this.activeFlashCount++;
        if(this.activeFlashCount >= 3)
          this.markDective(true);
      }, 200);
    }
  }
  public markDective(force = false) {
    if(force || this.currentRunner.stepMode) {
      this.el.classList.remove('actived');
      clearInterval(this.activeFlashInterval);
      this.activeFlashInterval = null;
  
      Object.keys(this.inputPorts).forEach(key => {
        let port = (<BlockPort>this.inputPorts[key]);
        if(port.connectedFromPort.length > 0)
          port.connectedFromPort.forEach(element => (<ConnectorEditor>element.connector).clearActive());
      });
    }
  }
  public addBottomTip(icon : string, text : string, className : string = '', show = true) {
    let d = document.createElement('div');
    d.setAttribute('class', className);
    d.innerHTML = '<i class="iconfont '+icon+' mr-2"></i>' + text;
    this.els.elBottomInfoHost.appendChild(d);
    this.els.elBottomInfoHost.style.display = '';
    return d;
  }
  public updateBottomTip(el : HTMLElement, icon : string, text : string, className : string = '') {
    el.setAttribute('class', className);
    el.innerHTML = '<i class="iconfont '+icon+' mr-2"></i>' + text;
    return el;
  }
  public deleteBottomTip(el : HTMLElement) {
    this.els.elBottomInfoHost.removeChild(el);
    if(this.els.elBottomInfoHost.childNodes.length == 0) 
      this.els.elBottomInfoHost.style.display = 'none';
  }

  private activeFlashInterval : any = null;
  private activeFlashCount = 0;

  //#endregion 

  //#region 其他事件

  public onUserDeletePort(port : BlockPort) {
    this.editor.getVue().$confirm('确定删除此端口？', '提示', {
      type: 'warning',
      confirmButtonClass: 'el-button-danger',
    }).then(() =>  this.deletePort(port.guid)).catch(() => {});
  }
  private callUserAddPort(direction : BlockPortDirection, type : 'execute'|'param') {
    let v = this.onUserAddPort(this, direction, type);
    if(CommonUtils.isArray(v)) {
      let arr = <BlockPortRegData[]>v;
      arr.forEach((p) => this.addPort(p, true));
    }else {
      this.addPort(<BlockPortRegData>v, true)
    }
    return v;
  }
  private onUserAddInputPort() { this.callUserAddPort('input', 'execute'); }
  private onUserAddOutputPort() { this.callUserAddPort('output', 'execute'); }
  private onUserAddInputParam() { this.callUserAddPort('input', 'param'); }
  private onUserAddOutputParam() { this.callUserAddPort('output', 'param'); }

  private onResize() {
    this.size.Set(
      this.el.offsetWidth,
      this.el.offsetHeight
    )
  }

  //#endregion 

  //#region 鼠标事件

  public mouseDown = false;
  public mouseConnectingPort = false;
  public mouseDownInPort = false;

  private mouseLastDownPos : Vector2 = new Vector2();
  private mouseLastDownPosInViewPort : Vector2 = new Vector2();
  private lastBlockPos : Vector2 = new Vector2();
  private lastMovedBlock = false;
  private lastBlockSize : Vector2 = new Vector2();
  private minBlockSize : Vector2 = new Vector2();

  private currentSizeType = 0;

  public isLastMovedBlock() { return this.lastMovedBlock; }
  public updateLastPos() { this.lastBlockPos.Set(this.position); }
  public getLastPos() { return this.lastBlockPos; }
  public getCurrentSizeType() { return this.currentSizeType; }

  private onMouseEnter(e : MouseEvent) {
    this.hover = true;
  }
  private onMouseOut(e : MouseEvent) {
    this.hover = false;
  }
  private onMouseMove(e : MouseEvent) {
    if(this.mouseDown) {

      if(typeof this.onMouseEvent === 'function' && this.onMouseEvent(this, 'move', e))
        return true;
      if(e.buttons == 1){ 
        //Resize
        //=====================
        if(this.currentSizeType) { 
          let mousePos = this.editor.windowPosToViewPortPos(new Vector2(e.x, e.y));
          let size = new Vector2(this.size.x, this.size.y);

          if (((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) && ((this.currentSizeType & SIZE_TOP) == SIZE_TOP)) {
            //左上
            size.x = (this.lastBlockPos.x + this.lastBlockSize.x - mousePos.x);
            size.y = (this.lastBlockPos.y + this.lastBlockSize.y - mousePos.y);
            this.setPos(mousePos);
          }
          else if(((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM) && ((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT)) {
            //右下
            size.x = (mousePos.x - this.lastBlockPos.x);
            size.y = (mousePos.y - this.lastBlockPos.y);
          }
          else if (((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) && ((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM)) {
            //左下
            size.x = (this.lastBlockPos.x + this.lastBlockSize.x - mousePos.x);
            size.y = (mousePos.y - this.lastBlockPos.y);
            this.setPos(new Vector2(mousePos.x, this.position.y));
          }
          else if (((this.currentSizeType & SIZE_TOP) == SIZE_TOP) && ((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT)) {
            //右上
            size.x = (mousePos.x - this.lastBlockPos.x);
            size.y = (this.lastBlockPos.y + this.lastBlockSize.y - mousePos.y);
            this.setPos(new Vector2(this.position.x, mousePos.y));
          }
          else if((this.currentSizeType & SIZE_TOP) == SIZE_TOP)  {
            //上
            size.y = (this.lastBlockPos.y + this.lastBlockSize.y - mousePos.y);
            this.setPos(new Vector2(this.position.x, mousePos.y));
          }
          else if((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM) {
            //下
            size.y = (mousePos.y - this.lastBlockPos.y);
          }
          else if((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) {
            //左
            size.x = (this.lastBlockPos.x + this.lastBlockSize.x - mousePos.x);
            this.setPos(new Vector2(mousePos.x, this.position.y));
          }
          else if((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT) {
            //右
            size.x = (mousePos.x - this.lastBlockPos.x);
          }            
          
          if(size.x < this.minBlockSize.x) size.x = this.minBlockSize.x;
          if(size.y < this.minBlockSize.y) size.y = this.minBlockSize.y;

          this.setSize(size);
        }
        //Move
        //=====================
        else if(!this.mouseDownInPort && !this.mouseConnectingPort) { 
          let zoom = 1 / this.editor.getViewZoom();
          let pos = new Vector2(
            this.lastBlockPos.x + (e.x * zoom - this.mouseLastDownPos.x * zoom),
            this.lastBlockPos.y + (e.y * zoom - this.mouseLastDownPos.y * zoom)
          );
          if(pos.x != this.position.x || pos.y != this.position.y) {
            this.lastMovedBlock = true;
            this.setPos(pos);
            this.editor.onMoveBlock(this, new Vector2(e.x * zoom - this.mouseLastDownPos.x * zoom, e.y * zoom - this.mouseLastDownPos.y * zoom));
    
            //如果当前块没有选中，在这里切换选中状态
            if(!this.selected) {
              let multiSelectBlocks = this.editor.getMultiSelectedBlocks();
              if(multiSelectBlocks.length == 0 || multiSelectBlocks.contains(this)) {
                this.updateSelectStatus(true);
                this.editor.onUserSelectBlock(this, true);
              }else {
                this.editor.unSelectAllBlocks();
                this.updateSelectStatus(true);
                this.editor.onUserSelectBlock(this, false);
              }
            }
          }
        }
        return true;
      }

    }
    else if(this.userCanResize) { //鼠标移动到边缘显示调整大小样式
      this.testInResize(e);
    }
    return false;
  }
  private onMouseDown(e : MouseEvent) {
    if(this.blockStyleSettings.layer == 'background' && this.editor.isAnyConnectorHover()) 
      return;
    if(!this.testIsDownInControl(e)) {
      this.mouseDown = true;
      this.mouseLastDownPos.Set(e.x, e.y);
      this.mouseLastDownPosInViewPort = this.editor.windowPosToViewPortPos(new Vector2(e.x, e.y));
      this.lastMovedBlock = false;
      this.lastBlockPos.Set(this.position);
      this.lastBlockSize.Set(this.size);

      if(this.userCanResize) {
        this.minBlockSize.x = this.el.style.minWidth ? parseInt(this.el.style.minWidth) : 111;
        this.minBlockSize.y = this.el.style.minWidth ? parseInt(this.el.style.minHeight) : 100;
        this.testInResize(e);
      }

      if(typeof this.onMouseEvent === 'function')
        this.onMouseEvent(this, 'down', e);

      document.addEventListener('mousemove', this.fnonMouseMove);
      document.addEventListener('mouseup', this.fnonMouseUp);

      e.stopPropagation();
    }
    this.updateCursor();
  }
  private onMouseUp(e : MouseEvent) {
    if(this.mouseDown) {
      this.mouseDown = false;

      if(!this.testIsDownInControl(e)){

        if(this.editor.isConnectorSelected()) 
          this.editor.unSelectAllConnector();

        if(this.lastMovedBlock) {
          this.editor.onMoveBlockEnd(this);
        }else if(this.editor.getMultiSelectedBlocks().length == 0 || e.button == 0) {     
          this.updateSelectStatus(this.editor.onUserSelectBlock(this, true));
        }

        if(typeof this.onMouseEvent === 'function')
          this.onMouseEvent(this, 'up', e);
      }
      this.updateCursor();
    }

    document.removeEventListener('mousemove', this.fnonMouseMove);
    document.removeEventListener('mouseup', this.fnonMouseUp);

  }
  private onMouseWhell(e : WheelEvent) {
    if(this.testIsDownInControl(e)) 
      e.stopPropagation();
  }
  private onContextMenu(e : MouseEvent) {
    if(this.editor.isConnectorSelected()) {
      this.editor.showConnectorRightMenu(new Vector2(e.x, e.y));
    }else {
      e.stopPropagation();
      e.preventDefault();
      this.editor.showBlockRightMenu(this, new Vector2(e.x, e.y));
    }
    return false;
  }

  private testInResize(e : MouseEvent) {
    let pos = this.editor.windowPosToViewPortPos(new Vector2(e.x, e.y));
    pos.substract(this.position);
    this.currentSizeType = 0;
    if(pos.x <= 6) this.currentSizeType |= SIZE_LEFT;
    else if(pos.x > this.size.x - 6) this.currentSizeType |= SIZE_RIGHT;
    if(pos.y <= 6) this.currentSizeType |= SIZE_TOP;
    else if(pos.y > this.size.y - 6) this.currentSizeType |= SIZE_BOTTOM;

    if(pos.x >= this.size.x - 20 && pos.y >= this.size.y - 20)
      this.currentSizeType |= (SIZE_BOTTOM | SIZE_RIGHT);

    this.updateCursor();
  }
  private updateCursor() {
    if(this.currentSizeType > 0) {
      if(
        (((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) && ((this.currentSizeType & SIZE_TOP) == SIZE_TOP))
        || (((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM) && ((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT))
      )
        this.el.style.cursor = 'nwse-resize';
      else if(
        (((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) && ((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM))
        || (((this.currentSizeType & SIZE_TOP) == SIZE_TOP) && ((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT))
      )
        this.el.style.cursor = 'nesw-resize';
      else if(((this.currentSizeType & SIZE_TOP) == SIZE_TOP) || ((this.currentSizeType & SIZE_BOTTOM) == SIZE_BOTTOM))
        this.el.style.cursor = 'ns-resize';
      else if(((this.currentSizeType & SIZE_LEFT) == SIZE_LEFT) || ((this.currentSizeType & SIZE_RIGHT) == SIZE_RIGHT))
        this.el.style.cursor = 'ew-resize';
      else 
        this.el.style.cursor = 'default';
    }else if(this.mouseDown) {
      this.el.style.cursor = 'move';
    }else {
      this.el.style.cursor = 'default';
    }
  }

  //#endregion 

  private testIsDownInControl(e : MouseEvent){
    let target = (<HTMLElement>e.target);
    return (HtmlUtils.isEventInControl(e)
      || target.classList.contains('flow-block-no-move') 
      || target.classList.contains('param-editor') 
      || target.classList.contains('port-delete') 
      || target.classList.contains('port')
      || target.classList.contains('custom-editor'));
  }


  //抛出错误处理
  public throwError(err : string, port ?: BlockPort, level : 'warning'|'error' = 'error', breakFlow = false) {

    
    //添加错误提示
    let errorNode = document.createElement('div');
    errorNode.classList.add('block-error');
    errorNode.classList.add(level);
    errorNode.innerHTML = `<i class="iconfont ${level==='warning'?'icon-error-1':'icon-error-'}"></i><span>${err}</span>`;

    ToolTipUtils.registerElementTooltip(errorNode)
    ToolTipUtils.updateElementTooltip(errorNode, errorNode.innerHTML);

    this.els.elBottomInfoHost.appendChild(errorNode);
    this.els.elBottomInfoHost.style.display = '';

    if(port != null) {
      (<BlockPortEditor>port).editorData.forceDotErrorState = true;
      (<BlockPortEditor>port).updatePortConnectStatusElement();
    }
    
    super.throwError(err, port, level, breakFlow);
  }
  /**
   * 清空所有错误
   */
  public clearErrors() {
    let nodes = this.els.elBottomInfoHost.childNodes;
    for(let i = nodes.length - 1; i >= 0; i--) {
      if((<HTMLElement>nodes[i]).classList.contains('block-error'))
        this.els.elBottomInfoHost.removeChild(nodes[i]);
    }
    if(this.els.elBottomInfoHost.childNodes.length == 0) 
      this.els.elBottomInfoHost.style.display = 'none';
  }

  private fnonMouseMove : MouseEventDelegate = null;
  private fnonMouseUp : MouseEventDelegate = null;

  public onCreateCustomEditor : BlockEditorComponentCreateFn = null;
  public onCreatePortCustomEditor : BlockPortEditorComponentCreateFn = null;
  public onUserAddPort : OnUserAddPortCallback = null;
  public onSave : OnBlockEditorEventCallback = null;
  public onMouseEvent : BlockMouseEventFn = null;

  //#region 端口连接处理事件

  public connectedPortCount = 0;
  public portAnyFlexables : BlockPortAnyFlexablesData = {};

  public isAnyPortConnected() { return this.connectedPortCount > 0; }
  public invokeOnPortConnect(port : BlockPort, portSource : BlockPort) {
    this.onPortConnect.invoke(this, port, portSource);
    this.connectedPortCount ++;
  }
  public invokeOnPortUnConnect(port : BlockPort) {
    this.onPortUnConnect.invoke(this, port);
    this.connectedPortCount--;

    if(!port.paramType.isExecute()) {
      let flexableKeys = Object.keys(this.portAnyFlexables);
      flexableKeys.forEach((key) => 
        BlockUtils.testAndResetFlexablePortType(<BlockEditor><any>this, key)
      );
    }
  }

  //弹性端口的参数变更

  public doChangeBlockFlexablePort(port : BlockPort) {
    if(!port.paramType.isExecute()) {
      let flexableKeys = Object.keys(this.portAnyFlexables);
      for(let i = 0; i < flexableKeys.length; i++) {
        let key = flexableKeys[i];
        let v = BlockUtils.doChangeBlockFlexablePort(this, port, key); 
        if(CommonUtils.isDefined(v)) {
          if(typeof this.portAnyFlexables[key].setResultToData == 'string')
            this.data[this.portAnyFlexables[key].setResultToData] = v;
          if(typeof this.portAnyFlexables[key].setResultToOptions == 'string')
            this.options[this.portAnyFlexables[key].setResultToOptions] = v;
        }
      };
    }
  }
  public testAndChangeFlexablePortType(portCurent: BlockPort, portTarget: BlockPort) {
    let currentIsAny = (portCurent.paramType.isAny() || (portCurent.paramSetType == 'dictionary' && portCurent.paramDictionaryKeyType.isAny()));
    let targetIsAny = (portTarget.paramType.isAny() || (portTarget.paramSetType == 'dictionary' && portTarget.paramDictionaryKeyType.isAny()));

    if(currentIsAny && !targetIsAny) { //目标 》 当前

      if(portCurent.paramSetType == 'dictionary')
        portCurent.paramDictionaryKeyType.set(portTarget.paramDictionaryKeyType);

      this.changePortParamType(portCurent, portTarget.paramType);
      this.doChangeBlockFlexablePort(portCurent);

      return true;

    } else if(!currentIsAny && targetIsAny) { //当前 》 目标

      if(portTarget.paramSetType == 'dictionary')
        portTarget.paramDictionaryKeyType.set(portCurent.paramDictionaryKeyType);
      portTarget.paramType.set(portCurent.paramType);

      (<BlockEditor>portTarget.parent).changePortParamType(portTarget, portCurent.paramType);
      (<BlockEditor>portTarget.parent).doChangeBlockFlexablePort(portTarget);

      return true;
    }

    return false;
  }

  //#endregion
}

/**
 * 单元的编辑器使用数据
 */
export class BlockEditorHTMLData {

  elInputPorts : HTMLDivElement = null;
  elOutputPorts : HTMLDivElement = null;

  elAddInputBehaviorPort : HTMLElement = null;
  elAddOutputBehaviorPort : HTMLElement = null;
  elAddInputParamPort : HTMLElement = null;
  elAddOutputParamPort : HTMLElement = null;

  elBottomInfoHost : HTMLElement = null;

  elBackground : HTMLDivElement = null;
  elTitle : HTMLDivElement = null;
  elTitleText : HTMLElement = null;
  elCustomEditor : HTMLDivElement = null;

  elLogo : HTMLDivElement = null;
  elLogoRight : HTMLDivElement = null;
  elLogoBottom : HTMLDivElement = null;

  elSizeDragger : HTMLDivElement = null;

  elBreakPointArrow : HTMLDivElement = null;
  elBreakPointStatus : HTMLDivElement = null ;

  elComment : HTMLDivElement = null;
  elCommentText : HTMLDivElement = null;
  elCommentPlaceHolder : HTMLSpanElement = null;
  elCommentOpen : HTMLElement = null;
  elCommentClose : HTMLElement = null;
}