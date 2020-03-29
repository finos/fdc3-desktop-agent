export interface Context {
    type : string;
    name ? : string;
    id?: {
        [x:string]: string;
    },
    [x: string]: any;
};