//author @huntbao
'use strict'

import Events from 'events'
import _ from 'lodash'
import AppConstants from '../constants/constants'
import AppDispatcher from '../dispatcher/dispatcher'
import ReqTabStore from './reqtabstore'
import Util from '../libs/util'
import Requester from '../components/requester/requester'

const CHANGE_EVENT = 'change'
const ACE_EDITOR_UPDATE_EVENT = 'ace editor update'
const DEFAULT_ACTIVE_INDEX = 0
const DEFAULT_KEY_STR = 'Key'
const DEFAULT_VALUE_STR = 'Value'
const BLANK_STR = ''
const REQ_HEADERS_DATA_LIST = 'reqheadersdatalist'
const REQ_MIDIATYPES_DATA_LIST = 'mediatypesdatalist'
const CONTENT_TYPE_STR = 'Content-Type'
const REQUEST_BODY_STR = 'Request Body'
const URL_PARAMS_STR = 'URL Params'
const REQUEST_HEADERS_STR = 'Request Headers'
const RESPONSE_CHECKER_STR = 'Response Checker'
const RESPONSE_STR = 'Response'
const REQ_PREPARE = 0
const REQ_SENDING = 1
const REQ_SUCCEEDED = 2
const REQ_FAILED = 3
const DEFAULT_KV = {
    keyPlaceholder: DEFAULT_KEY_STR,
    valuePlaceholder: DEFAULT_VALUE_STR,
    checked: true,
    key: BLANK_STR,
    value: BLANK_STR,
    keyDataList: '',
    valueDataList: ''
}
const DEFAULT_HEADERS_KV = Object.assign({}, DEFAULT_KV, {
    keyDataList: REQ_HEADERS_DATA_LIST
})
const DEFAULT_JSON_HEADER_KV = Object.assign({}, DEFAULT_HEADERS_KV, {
    keyDataList: REQ_HEADERS_DATA_LIST,
    valueDataList: REQ_MIDIATYPES_DATA_LIST,
    key: 'Content-Type',
    value: 'application/json'
})
const DEFAULT_PARAMS_KV = Object.assign({}, DEFAULT_KV, {
    keyPlaceholder: 'URL Parameter Key'
})
const DEFAULT_BODY_FORMDATA_KV = Object.assign({}, DEFAULT_KV, {
    valueType: 'text'
})
const DEFAULT_BODY_XFORM_KV = Object.assign({}, DEFAULT_KV)
const DEFAULT_RES_SHOW_TYPE = {
    type: 'Pretty',
    prettyType: 'HTML'
}
const DEFAULT_CON_ITEM = {
    builders: {
        items: [
            {
                name: URL_PARAMS_STR,
                disabled: false
            },
            {
                name: REQUEST_BODY_STR,
                disabled: false
            },
            {
                name: REQUEST_HEADERS_STR,
                disabled: false
            },
            {
                name: RESPONSE_CHECKER_STR,
                disabled: false
            },
            {
                name: RESPONSE_STR,
                disabled: false
            }
        ],
        paramKVs: [DEFAULT_PARAMS_KV],
        activeTabName: RESPONSE_STR,
        headerKVs: [DEFAULT_JSON_HEADER_KV, DEFAULT_HEADERS_KV],
        bodyType: {
            name: 'raw',
            value: 'JSON(application/json)'
        },
        bodyFormDataKVs: [DEFAULT_BODY_FORMDATA_KV],
        bodyXFormKVs: [DEFAULT_BODY_XFORM_KV],
        bodyBinaryData: null,
        bodyRawData: null,
        reqStatus: REQ_PREPARE,
        fetchResponse: null,
        fetchResponseRawData: null,
        fetchResponseIsJSON: false,
        resShowType: Object.assign({}, DEFAULT_RES_SHOW_TYPE),
        resFilePath: null
    },
    showBodyRawTypeList: false,
    showReqMethodList: false,
    showResPrettyTypeList: false,
    aceEditorConfig: {
        show: false,
        mode: 'json',
        readOnly: false,
        wrapMode: true
    }
}

// current active tab index
let tabIndex = 0

let tabCons = {
    bodyTypes: ['raw', 'form-data', 'x-www-form-urlencoded', 'binary'],
    rawTypes: [
        {
            value: 'text',
            name: 'Text',
            editorMode: 'text'
        },
        {
            value: 'text/plain',
            name: 'Text(text/plain)',
            editorMode: 'text'
        },
        {
            value: 'application/json',
            name: 'JSON(application/json)',
            editorMode: 'json'
        },
        {
            value: 'application/javascript',
            name: 'Javascript(application/javascript)',
            editorMode: 'javascript'
        },
        {
            value: 'application/xml',
            name: 'XML(application/xml)',
            editorMode: 'xml'
        },
        {
            value: 'text/xml',
            name: 'XML(text/xml)',
            editorMode: 'xml'
        },
        {
            value: 'text/html',
            name: 'XML(text/html)',
            editorMode: 'html'
        }
    ],
    reqMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD', 'OPTIONS', 'LINKS', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW'],
    prettyTypes: ['JSON', 'XML', 'HTML', 'Text'],
    items: [_.cloneDeep(DEFAULT_CON_ITEM)],
    aceEditorId: 'brace-editor'
}

let tabConActions = {

    addCon() {
        tabCons.items.push(_.cloneDeep(DEFAULT_CON_ITEM))
    },

    removeCon(tabIndex) {
        tabCons.items.splice(tabIndex, 1)
    },

    toggleReqMethodsList() {
        tabCons.items[tabIndex].showReqMethodList = !tabCons.items[tabIndex].showReqMethodList
    },

    changeMethod() {
        let tab = ReqTabStore.getTab(tabIndex)
        let isGetMethod = tab.method.toLowerCase() === 'get'
        let builders = tabCons.items[tabIndex].builders
        let bodyBuilder = _.find(builders.items, (builder) => {
            return builder.name === REQUEST_BODY_STR
        })
        bodyBuilder.disabled = isGetMethod
        if (isGetMethod && builders.activeTabName === REQUEST_BODY_STR) {
            this.switchBuilderTab(URL_PARAMS_STR)
        }
    },

    switchBuilderTab(activeTabName) {
        tabCons.items[tabIndex].builders.activeTabName = activeTabName
        this.changeAceEditorConfig()
    },

    changeAceEditorConfig(editorMode) {
        let tabCon = tabCons.items[tabIndex]
        let activeTabName = tabCon.builders.activeTabName
        let bodyType = tabCons.items[tabIndex].builders.bodyType
        let config = {
            show: activeTabName === REQUEST_BODY_STR && bodyType.name === 'raw' ||
                  activeTabName === RESPONSE_STR && tabCon.builders.reqStatus === REQ_SUCCEEDED,
            readOnly: activeTabName === RESPONSE_STR
        }
        if (editorMode) {
            config.mode = editorMode
        }
        Object.assign(tabCon.aceEditorConfig, config)
    },

    checkReqSend() {
        // check if can send request now
        // check two things: url and path variable
        let canSend = true
        let tabState = ReqTabStore.getAll()
        let tab = tabState.reqTab.tabs[tabIndex]
        let tabUrl = tab.url
        // check url
        if (!tabUrl) {
            // url can't be blank
            canSend = false
            tab.urlError = true
        } else {
            tab.urlError = false
        }
        if (!canSend) {
            return canSend
        }
        // check all path variable has it's value
        let params = tabCons.items[tabIndex].builders.paramKVs
        params.forEach((param, index) => {
            if (param.readonly) {
                if (!param.value) {
                    param.valueError = true
                    canSend = false
                } else {
                    tabUrl = tabUrl.replace(':' + param.key, param.value)
                }
            }
        })
        if (!canSend) {
            tabConActions.switchBuilderTab(URL_PARAMS_STR)
        }
        if (canSend) {
            tab.rurl = tabUrl // it is the correct request url
            let builders = tabCons.items[tabIndex].builders
            builders.reqStatus = REQ_SENDING
            tabConActions.switchBuilderTab(RESPONSE_STR)
            builders.fetchResponse = null
            builders.fetchResponseRawData = null
            builders.fetchResponseData = null
            builders.fetchResponseIsJSON = false
        }
        return canSend
    },

    sendReq() {
        let canSend = this.checkReqSend()
        if (!canSend) return
        Requester.fetch((res, data) => {
            console.log(res)
            tabConActions.switchBuilderTab(RESPONSE_STR)
            let tabCon = tabCons.items[tabIndex]
            let builders = tabCon.builders
            builders.fetchResponse = res
            builders.fetchResponseRawData = data
            if (!res) {
                // no response, error happened
                builders.reqStatus = REQ_FAILED
            } else {
                // has response
                builders.reqStatus = REQ_SUCCEEDED
                tabCon.aceEditorConfig.show = true
                builders.resShowType = Object.assign({}, DEFAULT_RES_SHOW_TYPE)
                try {
                    builders.fetchResponseData = JSON.stringify(JSON.parse(data), null, '\t')
                    builders.resShowType.prettyType = 'JSON'
                    tabCon.aceEditorConfig.mode = 'json'
                    builders.fetchResponseIsJSON = true
                } catch (e) {
                    //
                    builders.resShowType.prettyType = 'HTML'
                    tabCon.aceEditorConfig.mode = 'html'
                }
            }
            ReqTabConStore.emitChange()
            ReqTabConStore.emitAceEditorUpdate()
        })
    }
}

let paramActions = {

    fillURLParams() {
        let tabUrl = ReqTabStore.getTabUrl(tabIndex)
        let params = Util.getUrlParams(tabUrl)
        params = params.map((param) => {
            return Object.assign({}, DEFAULT_PARAMS_KV, param)
        })
        params.push(Object.assign({}, DEFAULT_PARAMS_KV))
        tabCons.items[tabIndex].builders.paramKVs = params
        // if has path variable, active url params tab
        let hasPathVariable = _.find(params, (param) => {
            return param.readonly
        })
        if (hasPathVariable) {
            tabConActions.switchBuilderTab(URL_PARAMS_STR)
        }
    },

    toggleURLParamsKV(rowIndex) {
        let kv = tabCons.items[tabIndex].builders.paramKVs[rowIndex]
        if (kv.readonly) return
        kv.checked = !tabCons.items[tabIndex].builders.paramKVs[rowIndex].checked
        this.updateTabUrl()
    },

    addURLParamsKV() {
        tabCons.items[tabIndex].builders.paramKVs.push(Object.assign({}, DEFAULT_PARAMS_KV))
    },

    removeURLParamsKV(rowIndex) {
        tabCons.items[tabIndex].builders.paramKVs.splice(rowIndex, 1)
        this.updateTabUrl()
    },

    changeURLParamsKVKey (rowIndex, value) {
        this.changeURLParams(rowIndex, value, 'key')
    },

    changeURLParamsKVValue (rowIndex, value) {
        this.changeURLParams(rowIndex, value, 'value')
    },

    changeURLParams(rowIndex, value, type) {
        let param = tabCons.items[tabIndex].builders.paramKVs[rowIndex]
        param[type] = value
        this.updateTabUrl()
    },

    updateTabUrl() {
        let tabUrl = ReqTabStore.getTabUrl(tabIndex)
        let params = tabCons.items[tabIndex].builders.paramKVs
        let newUrl = Util.setUrlQuery(tabUrl, params)
        ReqTabStore.setTabUrl(tabIndex, newUrl)
    }
}

let headerActions = {

    toggleHeaderKV(rowIndex) {
        let kv = tabCons.items[tabIndex].builders.headerKVs[rowIndex]
        if (kv.readonly) return
        kv.checked = !tabCons.items[tabIndex].builders.headerKVs[rowIndex].checked
    },

    addHeaderKV() {
        tabCons.items[tabIndex].builders.headerKVs.push(Object.assign({}, DEFAULT_HEADERS_KV))
    },

    removeHeaderKV(rowIndex) {
        tabCons.items[tabIndex].builders.headerKVs.splice(rowIndex, 1)
    },

    changeHeaderKVKey(rowIndex, value) {
        this.changeHeader(rowIndex, value, 'key')
    },

    changeHeaderKVValue(rowIndex, value) {
        this.changeHeader(rowIndex, value, 'value')
    },

    changeHeader(rowIndex, value, type) {
        let header = tabCons.items[tabIndex].builders.headerKVs[rowIndex]
        header[type] = value
        if (type === 'key' && header['keyDataList']) {
            if (value === CONTENT_TYPE_STR) {
                header.valueDataList = REQ_MIDIATYPES_DATA_LIST
            } else {
                header.valueDataList = BLANK_STR
            }
        }
        // change to body's raw type and update it's value
        if (header.key === CONTENT_TYPE_STR) {
            let rawType = _.find(tabCons.rawTypes, (rawType) => {
                return rawType.value === header.value
            })
            let bodyType = tabCons.items[tabIndex].builders.bodyType
            bodyType.name = 'raw'
            bodyType.value = rawType ? rawType.name : ''
        }
    }
}

let bodyActions = {

    changeBodyType(bodyType) {
        tabCons.items[tabIndex].builders.bodyType.name = bodyType
        tabConActions.changeAceEditorConfig()
    },

    changeBodyTypeValue(bodyType) {
        let isTextType = bodyType.name.toLowerCase() === 'text'
        let headers = tabCons.items[tabIndex].builders.headerKVs
        let contentType = _.find(headers, (header) => {
            return header.key == CONTENT_TYPE_STR
        })
        tabCons.items[tabIndex].builders.bodyType.value = bodyType.name
        if (!isTextType) {
            if (contentType) {
                // update header `Content-type`
                contentType.value = bodyType.value
            } else {
                // add header `Content-type`
                headers.unshift(Object.assign({}, DEFAULT_HEADERS_KV, {
                    key: CONTENT_TYPE_STR,
                    value: bodyType.value,
                    valueDataList: REQ_MIDIATYPES_DATA_LIST
                }))
            }
        } else if (contentType) {
            // clear header `Content-type`
            _.remove(headers, (header) => {
                return header.key === CONTENT_TYPE_STR
            })
        }
        tabConActions.changeAceEditorConfig(bodyType.editorMode)
    },

    toggleBodyTypeList() {
        tabCons.items[tabIndex].showBodyRawTypeList = !tabCons.items[tabIndex].showBodyRawTypeList
    },

    // body form data kv action
    toggleBodyFormDataKV(rowIndex) {
        let kv = tabCons.items[tabIndex].builders.bodyFormDataKVs[rowIndex]
        if (kv.readonly) return
        kv.checked = !tabCons.items[tabIndex].builders.bodyFormDataKVs[rowIndex].checked
    },

    addBodyFormDataKV() {
        tabCons.items[tabIndex].builders.bodyFormDataKVs.push(Object.assign({}, DEFAULT_BODY_FORMDATA_KV))
    },

    removeBodyFormDataKV(rowIndex) {
        tabCons.items[tabIndex].builders.bodyFormDataKVs.splice(rowIndex, 1)
    },

    changeBodyFormDataKVKey(rowIndex, value) {
        this.changeBodyFormData(rowIndex, value, 'key')
    },

    changeBodyFormDataKVValue(rowIndex, value) {
        this.changeBodyFormData(rowIndex, value, 'value')
    },

    changeBodyFormData(rowIndex, value, type) {
        let kv = tabCons.items[tabIndex].builders.bodyFormDataKVs[rowIndex]
        kv[type] = value
    },

    changeBodyFormDataKVValueType(rowIndex, value) {
        tabCons.items[tabIndex].builders.bodyFormDataKVs[rowIndex].valueType = value
    },

    // body x form kv action
    toggleBodyXFormKV(rowIndex) {
        let kv = tabCons.items[tabIndex].builders.bodyXFormKVs[rowIndex]
        if (kv.readonly) return
        kv.checked = !tabCons.items[tabIndex].builders.bodyXFormKVs[rowIndex].checked
    },

    addBodyXFormKV() {
        tabCons.items[tabIndex].builders.bodyXFormKVs.push(Object.assign({}, DEFAULT_BODY_XFORM_KV))
    },

    removeBodyXFormKV(rowIndex) {
        tabCons.items[tabIndex].builders.bodyXFormKVs.splice(rowIndex, 1)
    },

    changeBodyXFormKVKey(rowIndex, value) {
        this.changeBodyXForm(rowIndex, value, 'key')
    },

    changeBodyXFormKVValue(rowIndex, value) {
        this.changeBodyXForm(rowIndex, value, 'value')
    },

    changeBodyXForm(rowIndex, value, type) {
        let kv = tabCons.items[tabIndex].builders.bodyXFormKVs[rowIndex]
        kv[type] = value
    },

    changeBodyRawData(text) {
        let tabCon = tabCons.items[tabIndex]
        if (tabCon.builders.activeTabName === RESPONSE_STR) {
            // response tab, should not change bodyRawData
            return
        }
        tabCons.items[tabIndex].builders.bodyRawData = text
    }

}

let resActions = {

    toggleResPrettyTypeList() {
        tabCons.items[tabIndex].showResPrettyTypeList = !tabCons.items[tabIndex].showResPrettyTypeList
    },

    changeResPrettyTypeValue(prettyType) {
        tabCons.items[tabIndex].builders.resShowType.prettyType = prettyType
        tabCons.items[tabIndex].aceEditorConfig.mode = prettyType.toLowerCase()
    },

    changeResShowType(showType) {
        let tabCon = tabCons.items[tabIndex]
        tabCon.builders.resShowType.type = showType
        let editorConfig = {}
        let prettyType
        if (showType !== 'Pretty') {
            editorConfig.show = false
        } else {
            editorConfig.show = true
            if (tabCon.builders.fetchResponseIsJSON) {
                editorConfig.mode = 'json'
                prettyType = 'JSON'
            } else {
                editorConfig.mode = 'html'
                prettyType = 'HTML'
            }
        }
        Object.assign(tabCon.aceEditorConfig, editorConfig)
        tabCon.builders.resShowType.prettyType = prettyType
    }

}

let actions = Object.assign({}, tabConActions, paramActions, headerActions, bodyActions, resActions)

let ReqTabConStore = Object.assign({}, Events.EventEmitter.prototype, {

    getAll() {
        return {
            reqTabCon: {
                reqCons: tabCons.items,
                reqMethods: tabCons.reqMethods,
                bodyTypes: tabCons.bodyTypes,
                rawTypes: tabCons.rawTypes,
                prettyTypes: tabCons.prettyTypes,
                aceEditorId: tabCons.aceEditorId
            }
        }
    },

    emitChange() {
        this.emit(CHANGE_EVENT)
    },

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback)
    },

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback)
    },

    emitAceEditorUpdate() {
        this.emit(ACE_EDITOR_UPDATE_EVENT)
    },

    addAceEditorUpdateListener(callback) {
        this.on(ACE_EDITOR_UPDATE_EVENT, callback)
    },

    removeAceEditorUpdateListener(callback) {
        this.removeListener(ACE_EDITOR_UPDATE_EVENT, callback)
    }
})

AppDispatcher.register((action) => {
    tabIndex = ReqTabStore.getActiveIndex()
    switch (action.actionType) {
        // req content action --->
        case AppConstants.REQ_CONTENT_ADD:
            actions.addCon()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_CONTENT_REMOVE:
            actions.removeCon(action.tabIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_CONTENT_TOGGLE_METHODS_LIST:
            actions.toggleReqMethodsList()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_CONTENT_CHANGE_METHOD:
            actions.changeMethod()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_CONTENT_FILL_URL_PARAMS:
            actions.fillURLParams()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_CONTENT_UPDATE_ACE_EDITOR:
            ReqTabConStore.emitAceEditorUpdate()
            break

        case AppConstants.REQ_CONTENT_SEND:
            actions.sendReq()
            ReqTabConStore.emitChange()
            break
        // req content action <---


        // req url params action --->
        case AppConstants.REQ_URL_PARAMS_TOGGLE_KV:
            actions.toggleURLParamsKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_URL_PARAMS_ADD_KV:
            actions.addURLParamsKV()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_URL_PARAMS_REMOVE_KV:
            actions.removeURLParamsKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_URL_PARAMS_CHANGE_KV_KEY:
            actions.changeURLParamsKVKey(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_URL_PARAMS_CHANGE_KV_VALUE:
            actions.changeURLParamsKVValue(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break
        // req url params action <---


        // req builder action --->
        case AppConstants.REQ_BUILDER_SWITCH_TAB:
            actions.switchBuilderTab(action.activeTabName)
            ReqTabConStore.emitChange()
            ReqTabConStore.emitAceEditorUpdate()
            break

        case AppConstants.REQ_BODY_CHANGE_RAW_DATA:
            actions.changeBodyRawData(action.text)
            ReqTabConStore.emitChange()
            break
        // req builder action <---


        // req header action --->
        case AppConstants.REQ_HEADER_TOGGLE_KV:
            actions.toggleHeaderKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_HEADER_ADD_KV:
            actions.addHeaderKV()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_HEADER_REMOVE_KV:
            actions.removeHeaderKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_HEADER_CHANGE_KV_KEY:
            actions.changeHeaderKVKey(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_HEADER_CHANGE_KV_VALUE:
            actions.changeHeaderKVValue(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break
        // req header action <---


        // req body action --->
        case AppConstants.REQ_BODY_CHANGE_TYPE:
            actions.changeBodyType(action.bodyType)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_CHANGE_TYPE_VALUE:
            actions.changeBodyTypeValue(action.bodyTypeValue)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_TOGGLE_TYPE_LIST:
            actions.toggleBodyTypeList()
            ReqTabConStore.emitChange()
            break
        // body form data kv action
        case AppConstants.REQ_BODY_FORMDATA_TOGGLE_KV:
            actions.toggleBodyFormDataKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_FORMDATA_ADD_KV:
            actions.addBodyFormDataKV()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_FORMDATA_REMOVE_KV:
            actions.removeBodyFormDataKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_FORMDATA_CHANGE_KV_KEY:
            actions.changeBodyFormDataKVKey(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_FORMDATA_CHANGE_KV_VALUE:
            actions.changeBodyFormDataKVValue(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_FORMDATA_CHANGE_KV_VALUE_TYPE:
            actions.changeBodyFormDataKVValueType(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        //body x form kv action
        case AppConstants.REQ_BODY_XFORM_TOGGLE_KV:
            actions.toggleBodyXFormKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_XFORM_ADD_KV:
            actions.addBodyXFormKV()
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_XFORM_REMOVE_KV:
            actions.removeBodyXFormKV(action.rowIndex)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_XFORM_CHANGE_KV_KEY:
            actions.changeBodyXFormKVKey(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break

        case AppConstants.REQ_BODY_XFORM_CHANGE_KV_VALUE:
            actions.changeBodyXFormKVValue(action.rowIndex, action.value)
            ReqTabConStore.emitChange()
            break
        // req body action <---

        // res action --->
        case AppConstants.RES_TOGGLE_PRETTY_TYPE_LIST:
            actions.toggleResPrettyTypeList()
            ReqTabConStore.emitChange()
            break

        case AppConstants.RES_CHANGE_PRETTY_TYPE_VALUE:
            actions.changeResPrettyTypeValue(action.prettyType)
            ReqTabConStore.emitChange()
            ReqTabConStore.emitAceEditorUpdate()
            break

        case AppConstants.RES_CHANGE_SHOW_TYPE:
            actions.changeResShowType(action.showType)
            ReqTabConStore.emitChange()
            ReqTabConStore.emitAceEditorUpdate()
            break

        default:
            break
    }

})

export default ReqTabConStore
