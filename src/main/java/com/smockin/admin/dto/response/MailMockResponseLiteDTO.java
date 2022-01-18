package com.smockin.admin.dto.response;

import com.smockin.admin.dto.MailMockDTO;
import com.smockin.admin.persistence.enums.RecordStatusEnum;
import lombok.Data;

import java.util.Date;

@Data
public class MailMockResponseLiteDTO extends MailMockDTO {

    private String externalId;
    private Date dateCreated;

    public MailMockResponseLiteDTO(final String externalId,
                                   final Date dateCreated,
                                   final String address,
                                   final RecordStatusEnum status,
                                   final boolean saveReceivedMail
                               ) {
        super(address, status, saveReceivedMail);
        this.externalId = externalId;
        this.dateCreated = dateCreated;
    }

}
