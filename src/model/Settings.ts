import mongoose from "mongoose";

export interface ISetting extends mongoose.Document {
    field: string
    value: string
    description: string
    type: string
}

export const settings: Map<string, any> = new Map();

export enum ESettingType {
    boolean = 'boolean',
    string = 'string',
}

interface ISettingModel extends mongoose.Model<ISetting> {
    initSettings()

    getValue(field: string | Array<string>): Promise<string | Array<string>>

    setValue(field: string, value: string)
}

export const ISettingSchema = new mongoose.Schema({
    field: {type: String, required: true, unique: true, max: 30},
    value: {type: String},
    description: {type: String},
    type: {
        type: String,
        enum: Object.values(ESettingType),
        default: ESettingType.string
    }
})

const _settingToConfig = (setting: ISetting) => setting.type === ESettingType.boolean ? (setting.value.toLowerCase() === 'true') : setting.value

ISettingSchema.statics.initSettings = async function () {
    const values: Array<ISetting> = await this.find({}).lean()
    values.forEach((setting) => {
        settings.set(setting.field, _settingToConfig(setting))
    })
}

ISettingSchema.statics.getValue = async function (field: string | Array<string>): Promise<string | Array<string>> {
    // todo: add caching here

    const values = await this.find({field}).distinct('value').lean()
    if (!values) return

    return values.length == 1 ? values[0] : values
}

ISettingSchema.statics.setValue = async function (field: string, value: string) {
    const doc = await this.findOneAndUpdate({field}, {value}, {new: true})
    if (doc) {
        settings.set(doc.field, _settingToConfig(doc))
        console.log('settings changed', settings)
    }

}

const Setting: ISettingModel = mongoose.model<ISetting, ISettingModel>('Setting', ISettingSchema);
export default Setting;